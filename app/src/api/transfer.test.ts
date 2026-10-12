import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assessExport, buildExportOnServer, runExport } from './transfer';
import type { ExportPreflight } from './transfer';

// The export download is the one operation that routinely outlives a shared
// host's request timeout. What matters here is that the page never waits
// forever, and that an interrupted transfer is reported as resumable rather
// than as a loss — because the bytes already on disk are kept.

type Status = Record<string, unknown>;

/** Serves export/prepare once, then the given statuses in order, repeating the last. */
function stubServer(statuses: Status[]) {
  let polls = 0;
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes('export/prepare')) {
      return new Response(
        JSON.stringify({ token: 'a'.repeat(64), job: 'j1', files: 3, size: 1000, skippedMedia: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (String(url).includes('export/status')) {
      const status = statuses[Math.min(polls, statuses.length - 1)];
      polls += 1;
      return new Response(JSON.stringify(status), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Lets the polling loop run for a while without waiting in real time. */
async function tick(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

describe('runExport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves once the server reports the whole file sent', async () => {
    stubServer([
      { phase: 'sending', sent: 500, size: 1000 },
      { phase: 'done', sent: 1000, size: 1000 },
    ]);

    const result = runExport(() => {});
    await tick(5000);

    await expect(result).resolves.toMatchObject({ files: 3, size: 1000 });
  });

  // The server writes this when it is disconnected part way: the zip is kept
  // and the link stays live, so the right advice is "resume", not "start again".
  it('reports a paused transfer as resumable', async () => {
    stubServer([
      { phase: 'sending', sent: 400, size: 1000 },
      { phase: 'paused', sent: 400, size: 1000 },
    ]);

    const result = runExport(() => {});
    const rejects = expect(result).rejects.toThrow(/resume it from its downloads list/i);
    await tick(5000);
    await rejects;
  });

  // The case that actually bit: the host kills the worker, so the final status
  // is never written and the job sits at 'sending' forever. Before this the
  // page waited for a status that was never coming.
  it('gives up when the byte count stops moving', async () => {
    stubServer([{ phase: 'sending', sent: 400, size: 1000 }]);

    const result = runExport(() => {});
    const rejects = expect(result).rejects.toThrow(/resume it from its downloads list/i);
    await tick(60_000);
    await rejects;
  });

  it('keeps waiting while bytes are still arriving', async () => {
    let sent = 0;
    const statuses: Status[] = [];
    for (let i = 0; i < 200; i++) {
      sent += 10;
      statuses.push({ phase: 'sending', sent, size: 100_000 });
    }
    stubServer(statuses);

    const result = runExport(() => {});
    const settled = vi.fn();
    void result.then(settled, settled);

    // Well past the stall timeout, but the count has moved every poll.
    await tick(60_000);
    expect(settled, 'a slow but live download must not be abandoned').not.toHaveBeenCalled();
  });

  it('reports progress to the caller while sending', async () => {
    stubServer([
      { phase: 'sending', sent: 250, size: 1000 },
      { phase: 'sending', sent: 750, size: 1000 },
      { phase: 'done', sent: 1000, size: 1000 },
    ]);

    const seen: string[] = [];
    const result = runExport((s) => seen.push(s.phase));
    await tick(5000);
    await result;

    expect(seen).to.include('sending');
    expect(seen[0], 'the first thing shown is the collect step').to.eq('collecting');
  });
});

// ── Sliced download ──────────────────────────────────────────────────────────
//
// The host cuts any single response at a fixed point a little over 500MB and
// closes it cleanly, so the browser reports a complete download of a truncated
// archive. Fetching the file in slices is what gets around that, which makes
// every assertion below a guard on whether the backup is actually a backup.

interface FakeFile {
  chunks: Uint8Array[];
  closed: boolean;
  aborted: boolean;
}

function fakeSaveTarget(): { target: unknown; file: FakeFile } {
  const file: FakeFile = { chunks: [], closed: false, aborted: false };
  const target = {
    createWritable: async () => ({
      write: async (data: BufferSource) => {
        file.chunks.push(new Uint8Array(data as ArrayBuffer));
      },
      close: async () => { file.closed = true; },
      abort: async () => { file.aborted = true; },
    }),
  };
  return { target, file };
}

function written(file: FakeFile): Uint8Array {
  const total = file.chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of file.chunks) { out.set(c, at); at += c.length; }
  return out;
}

/** A server holding `size` bytes, answering Range requests like the plugin does. */
function stubRangeServer(size: number, opts: { failFirst?: number; status?: number } = {}) {
  const body = new Uint8Array(size);
  for (let i = 0; i < size; i++) body[i] = i % 251; // position-dependent, so order is checked
  let failures = opts.failFirst ?? 0;

  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes('export/prepare')) {
      return new Response(
        JSON.stringify({ token: 'a'.repeat(64), job: 'j1', files: 1, size, skippedMedia: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (String(url).includes('export/status')) {
      return new Response(JSON.stringify({ phase: 'ready', size }), { status: 200 });
    }
    // The archive itself.
    if (opts.status && opts.status !== 206) {
      return new Response(body, { status: opts.status });
    }
    if (failures > 0) {
      failures -= 1;
      throw new TypeError('network error');
    }
    const range = String((init?.headers as Record<string, string>)?.Range ?? '');
    const [, a, b] = /bytes=(\d+)-(\d+)/.exec(range) ?? [];
    const start = Number(a);
    const end = Number(b);
    return new Response(body.slice(start, end + 1), { status: 206 });
  }));

  return body;
}

describe('runExport writing to disk in slices', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('reassembles every slice in order, byte for byte', async () => {
    const size = 80 * 1024 * 1024; // spans three 32MB slices, the last one short
    const body = stubRangeServer(size);
    const { target, file } = fakeSaveTarget();

    await runExport(() => {}, target as never);

    const out = written(file);
    expect(out.length, 'the whole archive is written').to.eq(size);
    expect(file.closed, 'and the file is closed').to.eq(true);
    // Spot-check the seams, which is where an off-by-one in the range maths shows.
    for (const at of [0, 33554431, 33554432, 67108863, 67108864, size - 1]) {
      expect(out[at], `byte ${at}`).to.eq(body[at]);
    }
  });

  it('retries a slice that fails before giving up on the backup', async () => {
    const size = 40 * 1024 * 1024;
    const body = stubRangeServer(size, { failFirst: 2 });
    const { target, file } = fakeSaveTarget();

    await runExport(() => {}, target as never);

    expect(written(file).length).to.eq(size);
    expect(written(file)[size - 1]).to.eq(body[size - 1]);
  }, 30_000);

  // A server that ignores Range sends the whole file every time. Writing those
  // responses one after another would produce a large, plausible, useless file.
  it('refuses to proceed against a server that ignores Range', async () => {
    stubRangeServer(40 * 1024 * 1024, { status: 200 });
    const { target, file } = fakeSaveTarget();

    await expect(runExport(() => {}, target as never))
      .rejects.toThrow(/does not support part-by-part downloads/i);
    expect(file.closed, 'nothing is left behind as if it had worked').to.eq(false);
    expect(file.aborted).to.eq(true);
  });

  it('reports progress as slices land', async () => {
    const size = 70 * 1024 * 1024;
    stubRangeServer(size);
    const { target } = fakeSaveTarget();

    const sent: number[] = [];
    await runExport((s) => { if (s.phase === 'sending') sent.push(s.sent); }, target as never);

    expect(sent.length, 'one update per slice').to.be.greaterThan(1);
    expect(sent[sent.length - 1], 'ending at the full size').to.eq(size);
    expect([...sent].sort((a, b) => a - b), 'never going backwards').to.deep.eq(sent);
  });
});

// Building without downloading. The download is the step this host breaks, so
// the escape hatch is to skip it and collect the file off the server by hand.
describe('buildExportOnServer', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  function stubPrepare(extra: Record<string, unknown>) {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('export/prepare')) {
        return new Response(
          JSON.stringify({ token: 'a'.repeat(64), job: 'j1', files: 7, size: 1234, skippedMedia: 0, ...extra }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ phase: 'ready', size: 1234 }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('reports where the archive was left and never fetches it', async () => {
    const fetchMock = stubPrepare({ path: '/home/site/induction-transfer/induction-export-j1.zip' });

    const result = await buildExportOnServer(() => {});

    expect(result).toMatchObject({
      files: 7,
      size: 1234,
      path: '/home/site/induction-transfer/induction-export-j1.zip',
    });
    const fetched = fetchMock.mock.calls.map(([url]) => String(url));
    expect(
      fetched.some((url) => /export\?/.test(url)),
      'the download endpoint is the one thing this must not touch',
    ).to.eq(false);
  });

  // An older plugin answers prepare without a path. Showing "built on the
  // server" with nowhere to go would be worse than saying so.
  it('fails clearly when the server does not say where the file is', async () => {
    stubPrepare({});
    await expect(buildExportOnServer(() => {})).rejects.toThrow(/did not say where it put the file/i);
  });
});

// Telling an admin whether an export will work before they wait for it. The
// thresholds live in assessExport rather than in the panel so they can be read
// and checked here.
describe('assessExport', () => {
  function preflight(over: Partial<ExportPreflight> = {}): ExportPreflight {
    return {
      mediaCount: 10,
      mediaBytes: 50 * 1024 ** 2,
      contentBytes: 1024,
      estimatedBytes: 50 * 1024 ** 2,
      missing: 0,
      largest: [],
      freeBytes: 10 * 1024 ** 3,
      ...over,
    };
  }

  it('passes an ordinary export', () => {
    const verdict = assessExport(preflight());
    expect(verdict.level).to.eq('ok');
    expect(verdict.text).to.contain('50 MB');
  });

  // The size at which a single download has come back truncated on this host.
  it('warns past roughly 500MB and names the way round it', () => {
    const verdict = assessExport(preflight({ estimatedBytes: 700 * 1024 ** 2 }));
    expect(verdict.level).to.eq('warning');
    expect(verdict.text).to.contain('Build on server only');
  });

  it('stays quiet just under the threshold', () => {
    expect(assessExport(preflight({ estimatedBytes: 500 * 1024 ** 2 })).level).to.eq('ok');
  });

  // Disk beats size: there is no point advising a workaround for a download
  // that will never be built in the first place.
  it('calls out too little disk space before anything else', () => {
    const verdict = assessExport(preflight({
      estimatedBytes: 700 * 1024 ** 2,
      freeBytes: 100 * 1024 ** 2,
    }));
    expect(verdict.level).to.eq('error');
    expect(verdict.text).to.contain('free');
  });

  it('switches to GB once the archive passes one', () => {
    expect(assessExport(preflight({ estimatedBytes: 2.5 * 1024 ** 3 })).text).to.contain('2.5 GB');
  });

  // Some hosts do not report free space at all. A missing figure must not read
  // as "no space".
  it('does not invent a disk problem when free space is unknown', () => {
    const verdict = assessExport(preflight({ estimatedBytes: 50 * 1024 ** 2, freeBytes: null }));
    expect(verdict.level).to.eq('ok');
  });
});

// The media choices only matter if they reach the server.
describe('export media options', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  function capturePrepare() {
    const bodies: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('export/prepare')) {
        bodies.push(String(init?.body ?? ''));
        return new Response(
          JSON.stringify({ token: 'a'.repeat(64), job: 'j1', files: 0, size: 10, skippedMedia: 0, path: '/tmp/x.zip' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ phase: 'ready', size: 10 }), { status: 200 });
    }));
    return bodies;
  }

  it('sends a size threshold through to the build', async () => {
    const bodies = capturePrepare();
    await buildExportOnServer(() => {}, { maxFileMb: 50 });
    expect(JSON.parse(bodies[0])).toMatchObject({ maxFileMb: 50 });
  });

  it('sends the content-only choice through', async () => {
    const bodies = capturePrepare();
    await buildExportOnServer(() => {}, { includeMedia: false });
    expect(JSON.parse(bodies[0])).toMatchObject({ includeMedia: false });
  });

  it('asks for everything when nothing is chosen', async () => {
    const bodies = capturePrepare();
    await buildExportOnServer(() => {});
    const sent = JSON.parse(bodies[0]);
    expect(sent.maxFileMb, 'no limit').to.eq(undefined);
    expect(sent.includeMedia, 'and no exclusion').to.eq(undefined);
  });
});
