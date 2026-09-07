/// <reference types="cypress" />
import { testEnv } from '../../support/testEnv';

describe('Locations', () => {
  let locationId: number;

  after(() => {
    if (locationId) cy.api('DELETE', `induction/v1/locations/${locationId}`);
  });

  it('creates a location and round-trips markers and lines', () => {
    cy.api('POST', 'induction/v1/locations', {
      title: `Cypress ramp ${Date.now()}`,
      status: 'publish',
      address: '345D Wyampa Rd, Bald Hills QLD 4036',
      lat: -27.3226,
      lng: 153.0197,
      zoom: 17,
      markers: JSON.stringify([
        { id: 'm1', lat: -27.3226, lng: 153.0197, label: 'Meeting point', color: 'red' },
      ]),
      paths: JSON.stringify([
        { id: 'p1', label: 'Where to fish', color: 'amber', points: [[-27.3226, 153.0197], [-27.3230, 153.0205]] },
      ]),
      notes: '<ul><li>Set up at the gazebo</li></ul>',
    }).then(({ status, body }) => {
      expect(status).to.eq(200);
      locationId = body.id;
      expect(JSON.parse(body.markers)).to.have.length(1);
      expect(JSON.parse(body.paths)[0].points).to.have.length(2);
    });
  });

  it('clamps coordinates outside the valid range', () => {
    cy.api('POST', `induction/v1/locations/${locationId}`, { lat: 999, lng: -999 })
      .then(({ body }) => {
        expect(body.lat).to.be.at.most(90);
        expect(body.lng).to.be.at.least(-180);
      });
  });

  it('drops markers with impossible coordinates instead of storing them', () => {
    cy.api('POST', `induction/v1/locations/${locationId}`, {
      markers: JSON.stringify([
        { id: 'good', lat: -27.3, lng: 153.0, label: 'Keep', color: 'red' },
        { id: 'bad', lat: 500, lng: 500, label: 'Drop', color: 'red' },
      ]),
    }).then(({ body }) => {
      const markers = JSON.parse(body.markers);
      expect(markers.map((m: { id: string }) => m.id)).to.deep.eq(['good']);
    });
  });

  it('discards a line with fewer than two points', () => {
    cy.api('POST', `induction/v1/locations/${locationId}`, {
      paths: JSON.stringify([{ id: 'p1', label: 'Too short', color: 'amber', points: [[1, 2]] }]),
    }).then(({ body }) => {
      expect(JSON.parse(body.paths)).to.deep.eq([]);
    });
  });

  it('collapses unparseable marker data to empty rather than storing garbage', () => {
    cy.api('POST', `induction/v1/locations/${locationId}`, { markers: 'not json' })
      .then(({ body }) => {
        expect(JSON.parse(body.markers)).to.deep.eq([]);
      });
  });

  it('hides drafts from staff but shows published ones', () => {
    cy.loginAs('staff').then((token) => {
      cy.request({
        url: `${testEnv().wpUrl}/wp-json/induction/v1/locations?status=any`,
        headers: { Authorization: `Bearer ${token}` },
      }).then(({ body }) => {
        // `status=any` is admin-only; staff always get the published set.
        body.forEach((l: { status: string }) => expect(l.status).to.eq('publish'));
      });
    });
  });

  it('refuses writes from a staff token', () => {
    cy.loginAs('staff').then((token) => {
      cy.request({
        method: 'POST',
        url: `${testEnv().wpUrl}/wp-json/induction/v1/locations`,
        headers: { Authorization: `Bearer ${token}` },
        body: { title: 'Nope' },
        failOnStatusCode: false,
      }).its('status').should('be.oneOf', [401, 403]);
    });
  });
});

describe('Backup and migration', () => {
  it('exports an envelope with the documented shape', () => {
    cy.api('GET', 'induction/v1/transfer/export').then(({ status, body }) => {
      expect(status).to.eq(200);
      expect(body.format).to.eq('induction-platform-export');
      expect(body.format_version).to.be.a('number');
      expect(body).to.include.keys(['modules', 'locations', 'documents', 'media', 'records']);
      expect(body.records).to.include.keys(['progress', 'assignments', 'quiz_responses']);
    });
  });

  it('gives every module a ref that its records point at', () => {
    cy.api('GET', 'induction/v1/transfer/export').then(({ body }) => {
      const refs = body.modules.map((m: { ref: string }) => m.ref);
      expect(new Set(refs).size, 'refs are unique').to.eq(refs.length);

      [...body.records.progress, ...body.records.assignments].forEach(
        (row: { module_ref: string }) => expect(refs).to.include(row.module_ref),
      );
    });
  });

  it('never exports a raw user_id in place of a portable reference', () => {
    cy.api('GET', 'induction/v1/transfer/export').then(({ body }) => {
      body.records.progress.forEach((row: Record<string, unknown>) => {
        expect(row).to.not.have.property('user_id');
        expect(row.user).to.include.keys(['login', 'email']);
      });
    });
  });

  it('rejects a file that is not one of our exports', () => {
    cy.api('POST', 'induction/v1/transfer/import', { format: 'something-else' })
      .then(({ status, body }) => {
        expect(status).to.eq(400);
        expect(body.code).to.eq('induction_bad_export');
      });
  });

  it('rejects an export from a newer plugin version', () => {
    cy.api('POST', 'induction/v1/transfer/import', {
      format: 'induction-platform-export',
      format_version: 9999,
    }).then(({ status, body }) => {
      expect(status).to.eq(400);
      expect(body.code).to.eq('induction_export_too_new');
    });
  });

  it('refuses export to a staff token — it contains everyone\'s records', () => {
    cy.loginAs('staff').then((token) => {
      cy.request({
        url: `${testEnv().wpUrl}/wp-json/induction/v1/transfer/export`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).its('status').should('be.oneOf', [401, 403]);
    });
  });
});
