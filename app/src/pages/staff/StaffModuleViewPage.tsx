import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  ButtonBase,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PauseCircleOutlined from "@mui/icons-material/PauseCircleOutlined";
import PlayCircleOutlined from "@mui/icons-material/PlayCircleOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import StopCircleOutlined from "@mui/icons-material/StopCircleOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VolumeUpOutlined from "@mui/icons-material/VolumeUpOutlined";
import {
  usePortalModule,
  useMyAssignments,
  useModuleProgress,
  useMarkComplete,
  useSetCompletedSections,
  useSubmitQuizForReview,
} from "../../hooks/usePortal";
import {
  upsertProgress,
  saveQuizAnswer,
  checkQuizAnswer,
  fetchQuizResponses,
} from "../../api/portal";
import { useAuthStore } from "../../store/authStore";
import { useSpeech } from "../../hooks/useSpeech";
import BlockRenderer from "../../components/BlockRenderer";
import { scrollAncestorsToTop } from "../../util/scroll";
import { formatDueDate } from "../../util/dates";
import {
  isSectionComplete as sectionIsComplete,
  moduleProgressPercent,
  readCompletedSectionIds,
  sectionCompletionKey,
} from "../../util/sectionProgress";
import HeroBanner from "../../components/HeroBanner";
import { sectionToSpeechText, visibleSections } from "../../blocks/utils";
import type { Section } from "../../types";

// Fallback gradients for sections without a hero image
const SECTION_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
];

export default function StaffModuleViewPage() {
  const { id } = useParams<{ id: string }>();
  const moduleId = Number(id);
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id ?? 0);

  const { data: module, isLoading, error } = usePortalModule(moduleId);
  const { progress, isLoading: progressLoading } = useModuleProgress(moduleId);
  const markComplete = useMarkComplete();
  const submitQuizReview = useSubmitQuizForReview();
  const speech = useSpeech();

  const lsKey = sectionCompletionKey(moduleId);

  const startTime = useRef(Date.now());
  // Moving between sections swaps content without changing route, so nothing
  // resets the scroll position — readers landed part way down the next section.
  // Keyed on the section id rather than wired to each control, so Next, Back,
  // the section dropdown and "Attempt Now" are all covered by one rule.
  const viewTopRef = useRef<HTMLDivElement>(null);

  // "Continue" on a module card links straight to a section. Read once, as
  // the initial value rather than in an effect: `sections` is derived from the
  // module in the same render it arrives, so there is no window in which the
  // overview paints first and then jumps. An id that no longer matches a
  // section — one deleted or unpublished since the card was drawn — simply
  // leaves this at the overview.
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    searchParams.get("section"),
  );
  const [sectionView, setSectionView] = useState<"all" | "completed" | "todo">(
    "all",
  );
  // Mirrors the server. Held locally as well so the tick and the progress bar
  // move the moment someone presses Next, rather than after a round trip.
  const [completedSectionIds, setCompletedSectionIds] = useState<string[]>([]);
  const { mutate: saveSections } = useSetCompletedSections(moduleId);
  // A failed save leaves the tick on screen but not on the server, so it has
  // to be said out loud — silently losing someone's place is how a staff
  // member ends up reading a module twice.
  const [saveFailed, setSaveFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // null for a short answer: revealed, but not judged.
  const [showResults, setShowResults] = useState<Record<
    string,
    boolean | null
  > | null>(null);
  // Short-answer guidance, returned by the check endpoint rather than sent with
  // the module, so it is not readable before the learner attempts the question.
  const [answerGuidance, setAnswerGuidance] = useState<Record<string, string>>({});
  const [checkingQuiz, setCheckingQuiz] = useState(false);

  const { sections, hasQuiz, moduleQuizBlockIds, hasAnyQuiz } = useMemo(() => {
    if (!module) {
      return {
        sections: [] as Section[],
        hasQuiz: false,
        moduleQuizBlockIds: [] as string[],
        hasAnyQuiz: false,
      };
    }
    const parsed = visibleSections(module.meta.module_blocks);
    const moduleQuizSection = parsed.find((s) => s.isModuleQuiz) ?? null;
    const moduleQuizBlockIds =
      moduleQuizSection?.quizBlocks.map((b) => b.id) ?? [];
    const hasAnyQuiz = parsed.some((s) => s.quizBlocks.length > 0);
    return {
      sections: parsed,
      hasQuiz: moduleQuizBlockIds.length > 0,
      moduleQuizBlockIds,
      hasAnyQuiz,
    };
  }, [module]);

  const { data: myAssignments = [] } = useMyAssignments();
  const myDueDate =
    myAssignments.find((a) => a.moduleId === moduleId)?.dueDate ?? null;

  const currentSection =
    sections.find((s) => s.id === selectedSectionId) ?? null;

  useEffect(() => {
    scrollAncestorsToTop(viewTopRef.current);
  }, [selectedSectionId]);

  // Keep ?section= pointing at whatever is open, so a refresh or a shared link
  // lands where the reader actually is rather than where they came in. Keyed
  // on the section id for the same reason the scroll reset above is: Next,
  // Previous, the dropdown and the back arrow all change sections, and wiring
  // each of them separately is how one gets missed.
  //
  // replace, not push: moving between sections never added history entries
  // before, and turning Back into "previous section" would strand someone
  // several presses from the dashboard. The equality check keeps this from
  // looping on its own update.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedSectionId) {
      next.set("section", selectedSectionId);
    } else {
      next.delete("section");
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [selectedSectionId, searchParams, setSearchParams]);

  useEffect(() => {
    // Seed from the server, then adopt anything this browser recorded before
    // section progress moved server-side. Local wins only where the server has
    // nothing: once a person has progress on their account, a stale copy in
    // some old browser must not resurrect sections they have since unmarked.
    if (!progress) return;

    const fromServer = progress.completedSections ?? [];
    if (fromServer.length > 0) {
      setCompletedSectionIds(fromServer);
      localStorage.removeItem(lsKey);
      return;
    }

    const local = readCompletedSectionIds(moduleId);
    if (local.length > 0) {
      setCompletedSectionIds(local);
      saveSections(local);
      localStorage.removeItem(lsKey);
    }
  }, [progress, moduleId, lsKey, saveSections]);

  // Stop any in-progress narration when the viewer moves to a different
  // section (or back to the overview) rather than letting it keep reading.
  // speech.stop is stable (useCallback in useSpeech); the `speech` object
  // itself is recreated every render, so depending on it here would cancel
  // playback on the very next render after speak() is called.
  useEffect(() => {
    speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSectionId, speech.stop]);

  useEffect(() => {
    // Wait for the real progress record before deciding it's missing — on
    // first mount `progress` is briefly undefined purely because the fetch
    // hasn't resolved yet, which used to be mistaken for "never started"
    // and stomped an already-completed module back to in_progress.
    if (!moduleId || !userId || progressLoading) return;
    if (!progress || progress.status === "not_started") {
      upsertProgress(userId, moduleId, "in_progress", 0).catch(() => {});
    }
  }, [moduleId, userId, progress, progressLoading]);

  useEffect(() => {
    if (!moduleId || !userId || !hasAnyQuiz) return;
    fetchQuizResponses(userId, moduleId)
      .then((responses) => {
        const saved: Record<string, string> = {};
        for (const r of responses) saved[r.blockId] = r.answer;
        if (Object.keys(saved).length > 0) setAnswers(saved);
      })
      .catch(() => {});
  }, [moduleId, userId, hasAnyQuiz]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{(error as Error).message}</Alert>;
  if (!module) return <Alert severity="warning">Module not found.</Alert>;

  // No autoHideDuration: this is not a confirmation that can be missed
  // harmlessly. It stays until it is retried or dismissed. Rendered by both
  // the section view and the overview, since finishing the last section fails
  // on one screen and lands you on the other.
  const saveErrorToast = (
    <Snackbar
      open={saveFailed}
      onClose={() => setSaveFailed(false)}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        severity="warning"
        onClose={() => setSaveFailed(false)}
        action={
          <Button color="inherit" size="small" onClick={retrySaveSections}>
            Retry
          </Button>
        }
        sx={{ boxShadow: "0 14px 40px rgba(15, 23, 42, 0.18)" }}
      >
        Couldn't save your progress. You may have to redo this section next
        time you open the module.
      </Alert>
    </Snackbar>
  );

  const isCompleted = progress?.status === "completed";
  // The module-level quiz is graded by an admin, not self-checked — it's only
  // "done" once progress.passed comes back true. Other sections still rely on
  // the local completedSectionIds flag from the manual "Mark complete" button.
  const quizSubmittedAt = progress?.quizSubmittedAt ?? null;
  const quizPassed = progress?.passed ?? null;
  const quizPending = !!quizSubmittedAt && quizPassed === null;
  const quizLocked = quizPending || quizPassed === true;

  function isSectionComplete(section: Section): boolean {
    return sectionIsComplete(section, completedSectionIds, quizPassed);
  }

  // Every section other than the module-level quiz section itself must be completed.
  const otherSectionsComplete = sections
    .filter((s) => !s.isModuleQuiz)
    .every(isSectionComplete);

  function handleAnswer(blockId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [blockId]: answer }));
    // Changing an answer invalidates any previously checked result for it.
    setShowResults((prev) => {
      if (!prev || !(blockId in prev)) return prev;
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
    saveQuizAnswer(userId, moduleId, blockId, answer).catch(() => {});
  }

  // Section-level quizzes only — the module-level quiz is graded by an admin
  // (see handleSubmitQuizForReview) and never self-checked.
  async function handleCheckQuiz(section: Section) {
    const blockIds = section.quizBlocks.map((b) => b.id);
    const answeredIds = blockIds.filter((bid) => answers[bid] !== undefined);
    if (answeredIds.length === 0) return;
    setCheckingQuiz(true);
    try {
      const results = await Promise.all(
        answeredIds.map((bid) =>
          checkQuizAnswer(userId, moduleId, bid, answers[bid]),
        ),
      );
      const resultMap: Record<string, boolean | null> = {};
      const guidanceMap: Record<string, string> = {};
      answeredIds.forEach((bid, i) => {
        resultMap[bid] = results[i].isCorrect;
        if (results[i].guidance) guidanceMap[bid] = results[i].guidance as string;
      });
      setShowResults((prev) => ({ ...prev, ...resultMap }));
      setAnswerGuidance((prev) => ({ ...prev, ...guidanceMap }));
    } finally {
      setCheckingQuiz(false);
    }
  }

  async function handleSubmitQuizForReview() {
    await submitQuizReview.mutateAsync(moduleId);
  }

  // One place that records a tick, so the optimistic state and the server
  // cannot be updated from one path and not the other.
  //
  // The tick stays on screen when the save fails. Pulling it back out from
  // under someone who has already moved to the next section would be worse
  // than a notice they can act on — and because every save sends the whole
  // set, the next successful one repairs the record anyway.
  function recordSections(next: string[]) {
    setCompletedSectionIds(next);
    saveSections(next, {
      onSuccess: () => setSaveFailed(false),
      onError: () => setSaveFailed(true),
    });
  }

  // Retries with the current set rather than the payload that failed: if a
  // save failed and the reader has since unmarked something, the server
  // should get where they actually are, not where they were.
  function retrySaveSections() {
    saveSections(completedSectionIds, {
      onSuccess: () => setSaveFailed(false),
    });
  }

  /**
   * Moving on from a section is what marks it done.
   *
   * Pressing Next used to leave no trace, so someone could read a whole module
   * and still sit at 0% — while the one button that did record anything threw
   * them back to the overview. Advancing is the natural signal, so it is the
   * one we record; Previous deliberately does not, since going back is not
   * progress.
   *
   * A section's own quiz does not gate this: advancing always ticks.
   */
  function goToSection(target: string | null) {
    if (selectedSectionId && !completedSectionIds.includes(selectedSectionId)) {
      recordSections([...completedSectionIds, selectedSectionId]);
    }
    setSelectedSectionId(target);
  }

  function handleUnmarkSectionComplete() {
    if (!selectedSectionId) return;
    recordSections(completedSectionIds.filter((id) => id !== selectedSectionId));
  }

  async function handleMarkComplete() {
    setSaving(true);
    const timeSpent = Math.round((Date.now() - startTime.current) / 1000);
    try {
      await markComplete.mutateAsync({ moduleId, timeSpent });
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Section detail view ──────────────────────────────────────────────────
  if (currentSection) {
    const sectionIndex = sections.findIndex((s) => s.id === selectedSectionId);
    const sectionHasQuiz = currentSection.quizBlocks.length > 0;
    const isSectionDone = isSectionComplete(currentSection);
    const prevSection = sectionIndex > 0 ? sections[sectionIndex - 1] : null;
    const nextSection =
      sectionIndex < sections.length - 1 ? sections[sectionIndex + 1] : null;
    // Shared with the dashboard card on purpose: two copies of this sum is how
    // the two screens end up reporting different numbers for one module.
    const progressPct = moduleProgressPercent(
      sections,
      completedSectionIds,
      quizPassed,
      progress?.status ?? 'not_started',
    );
    const speechText = sectionToSpeechText(currentSection);

    return (
      <Box ref={viewTopRef} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Top bar */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton onClick={() => setSelectedSectionId(null)} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: "0.95rem",
              letterSpacing: "normal",
            }}
          >
            Back to sections
          </Typography>
        </Box>

        {/* Section dropdown */}
        <TextField
          select
          size="small"
          label="Jump to section"
          value={selectedSectionId ?? ""}
          onChange={(e) => setSelectedSectionId(e.target.value)}
          fullWidth
        >
          {sections.map((s, i) => (
            <MenuItem key={s.id} value={s.id}>
              Section {i + 1}
              {s.title ? ` — ${s.title}` : ""}
              {isSectionComplete(s) ? "  ✓" : ""}
            </MenuItem>
          ))}
        </TextField>

        {/* Title and description */}
        {(currentSection.title || currentSection.description || speechText) && (
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              {currentSection.title && (
                <Typography variant="h2" sx={{ mb: 0.5 }}>
                  {currentSection.title}
                </Typography>
              )}
              {currentSection.description && (
                <Typography color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {currentSection.description}
                </Typography>
              )}
            </Box>

            {speech.supported && speechText && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    speech.status === "playing" ? (
                      <PauseCircleOutlined />
                    ) : speech.status === "paused" ? (
                      <PlayCircleOutlined />
                    ) : (
                      <VolumeUpOutlined />
                    )
                  }
                  onClick={() => {
                    if (speech.status === "playing") speech.pause();
                    else if (speech.status === "paused") speech.resume();
                    else speech.speak(speechText);
                  }}
                  sx={{ borderRadius: 999 }}
                >
                  {speech.status === "playing"
                    ? "Pause"
                    : speech.status === "paused"
                      ? "Resume"
                      : "Read aloud"}
                </Button>
                {speech.status !== "idle" && (
                  <IconButton size="small" onClick={speech.stop} aria-label="Stop reading">
                    <StopCircleOutlined fontSize="small" />
                  </IconButton>
                )}
              </Box>
            )}
          </Box>
        )}

        {/* Content blocks */}
        {currentSection.blocks.length > 0 && (
          <Paper sx={{ p: { xs: 3, md: 4 } }}>
            <BlockRenderer
              imageSources={module?.imageSources}
              blocks={currentSection.blocks}
              answers={answers}
              onAnswer={handleAnswer}
              showResults={showResults}
              answerGuidance={answerGuidance}
            />
          </Paper>
        )}

        {/* Quiz */}
        {sectionHasQuiz && (
          <Paper sx={{ p: { xs: 3, md: 4 } }}>
            {currentSection.quizTitle && (
              <Typography variant="h3" sx={{ mb: 2.5 }}>
                {currentSection.quizTitle}
              </Typography>
            )}
            {currentSection.isModuleQuiz ? (
              !otherSectionsComplete ? (
                <Alert severity="warning">
                  Complete all other sections before attempting the module-level
                  quiz.
                </Alert>
              ) : (
                <>
                  {quizPending && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Submitted — awaiting review by an admin.
                    </Alert>
                  )}
                  {quizPassed === true && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Passed — reviewed by an admin.
                    </Alert>
                  )}
                  {quizPassed === false && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      Not passed. You may update your answers and resubmit.
                    </Alert>
                  )}
                  <BlockRenderer
                    imageSources={module?.imageSources}
                    blocks={currentSection.quizBlocks}
                    answers={answers}
                    onAnswer={handleAnswer}
                    showResults={null}
                    disabled={quizLocked}
                  />
                  {!quizLocked && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Use the "Submit Quiz for Review" button on the module
                      overview page once you've answered every question.
                    </Typography>
                  )}
                </>
              )
            ) : (
              <>
                <BlockRenderer
                  imageSources={module?.imageSources}
                  blocks={currentSection.quizBlocks}
                  answers={answers}
                  onAnswer={handleAnswer}
                  showResults={showResults}
                  answerGuidance={answerGuidance}
                />
                <Button
                  variant="contained"
                  onClick={() => handleCheckQuiz(currentSection)}
                  disabled={
                    checkingQuiz ||
                    currentSection.quizBlocks.every(
                      (b) => answers[b.id] === undefined,
                    )
                  }
                  sx={{ mt: 1 }}
                >
                  {checkingQuiz ? "Checking…" : "Check Answers"}
                </Button>
              </>
            )}
          </Paper>
        )}

        {/* Taking a tick back. There is no matching "mark complete": moving
            on is what records a section, so a second control competing with
            Next — and throwing the reader back to the overview — is gone. */}
        {!currentSection.isModuleQuiz && isSectionDone && (
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="outlined"
              color="error"
              sx={{ borderRadius: "10px" }}
              onClick={handleUnmarkSectionComplete}
            >
              Unmark as complete
            </Button>
          </Box>
        )}

        {/* Prev | Progress bar | Next */}
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              onClick={() =>
                prevSection && setSelectedSectionId(prevSection.id)
              }
              disabled={!prevSection}
              sx={{ borderRadius: 999, order: { xs: 2, sm: 0 } }}
            >
              ← Previous
            </Button>

            <Box sx={{ flexGrow: 1, flexBasis: { xs: "100%", sm: "auto" }, minWidth: 0, order: { xs: 1, sm: 0 } }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 0.5,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  {progressPct}% complete
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progressPct}
                sx={{
                  height: 8,
                  borderRadius: 999,
                  bgcolor: "divider",
                  "& .MuiLinearProgress-bar": { borderRadius: 999 },
                }}
              />
            </Box>

            {/* The primary action on the page now that it is the one that
                records progress — it used to be outlined while a button that
                ejected you to the overview was solid blue. */}
            <Button
              variant="contained"
              onClick={() => goToSection(nextSection ? nextSection.id : null)}
              sx={{ borderRadius: 999, order: { xs: 3, sm: 0 }, ml: { xs: "auto", sm: 0 } }}
            >
              {nextSection ? "Next →" : "Finish section"}
            </Button>
          </Box>
        </Paper>

        {saveErrorToast}
      </Box>
    );
  }

  // ── Section list view (module overview) ─────────────────────────────────
  return (
    <Box ref={viewTopRef} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* One target, not an icon with a label beside it. Now that modules are
          no longer in the sidebar this is the route between them, and on a
          phone a 24px icon is a poor thing to have to hit. */}
      <Box>
        <ButtonBase
          onClick={() => navigate("/portal")}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            py: 0.75,
            pr: 1.5,
            borderRadius: "10px",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <ArrowBackIcon fontSize="small" />
          <Typography
            sx={{ fontWeight: 600, fontSize: "0.95rem", letterSpacing: "normal" }}
          >
            Back to Modules
          </Typography>
        </ButtonBase>
      </Box>

      <Box sx={{ mx: { xs: -2, md: -4 } }}>
        <HeroBanner
          module={module}
          dueDate={formatDueDate(myDueDate)}
          minutes={module.meta.module_estimated_minutes}
        />
      </Box>

      {module.content && (
        <Box>
          <Typography variant="h4" sx={{ mb: 1 }}>
            Module Overview
          </Typography>
          <Box
            sx={{
              color: "text.secondary",
              lineHeight: 1.7,
              "& p": { margin: 0 },
              "& p + p": { mt: 1.5 },
              "& img": { maxWidth: "100%", height: "auto" },
            }}
            dangerouslySetInnerHTML={{ __html: module.content }}
          />
        </Box>
      )}

      {sections.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <ToggleButtonGroup
            value={sectionView}
            exclusive
            onChange={(_, next) => next && setSectionView(next)}
            sx={{
              gap: 1,
              flexWrap: "wrap",
              "&& .MuiToggleButtonGroup-grouped": {
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "999px !important",
                marginLeft: 0,
                px: { xs: 1.5, sm: 2 },
                py: 0.5,
                textTransform: "none",
                fontWeight: 500,
                fontSize: { xs: 12, sm: 13 },
                whiteSpace: "nowrap",
                // Scoped away from the selected pill. The group rule and each button's
                // "&&.Mui-selected" both land on three classes, so the winner
                // came down to emotion's insertion order — and the group won,
                // painting slate text onto a solid primary fill. Excluding the
                // selected state removes the race instead of out-specifying it.
                "&:not(.Mui-selected)": { color: "text.secondary" },
                "&:hover": { bgcolor: "action.hover" },
              },
            }}
          >
            <ToggleButton
              value="all"
              sx={{
                "&&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "white",
                  borderColor: "primary.main",
                  "&:hover": { bgcolor: "primary.dark" },
                },
              }}
            >
              All Sections
            </ToggleButton>
            <ToggleButton
              value="completed"
              sx={{
                "& .MuiSvgIcon-root": { color: "success.main" },
                "&&.Mui-selected": {
                  bgcolor: "success.main",
                  color: "white",
                  borderColor: "success.main",
                  "& .MuiSvgIcon-root": { color: "white" },
                  "&:hover": { bgcolor: "success.dark" },
                },
              }}
            >
              <CheckCircleOutlined fontSize="small" sx={{ mr: 0.75 }} />
              Completed
            </ToggleButton>
            <ToggleButton
              value="todo"
              sx={{
                "& .MuiSvgIcon-root": { color: "warning.main" },
                "&&.Mui-selected": {
                  bgcolor: "warning.main",
                  color: "white",
                  borderColor: "warning.main",
                  "& .MuiSvgIcon-root": { color: "white" },
                  "&:hover": { bgcolor: "warning.dark" },
                },
              }}
            >
              <ScheduleOutlined fontSize="small" sx={{ mr: 0.75 }} />
              To Complete
            </ToggleButton>
          </ToggleButtonGroup>

          {sections
            .filter((s) => {
              const done = isSectionComplete(s);
              if (sectionView === "completed") return done;
              if (sectionView === "todo") return !done;
              return true;
            })
            .map((section) => {
              const index = sections.indexOf(section);
              const done = isSectionComplete(section);
              const gradient =
                SECTION_GRADIENTS[index % SECTION_GRADIENTS.length];
              return (
                <Card
                  key={section.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderLeftWidth: 10,
                    borderLeftColor: done ? "grey.300" : "primary.main",
                  }}
                >
                  <CardContent
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 2,
                      "&:last-child": { pb: 2 },
                    }}
                  >
                    {/* Square hero thumbnail */}
                    <Box
                      sx={{
                        width: 88,
                        height: 88,
                        borderRadius: 1.5,
                        flexShrink: 0,
                        overflow: "hidden",
                        position: "relative",
                        background: section.heroImage ? undefined : gradient,
                      }}
                    >
                      {section.heroImage && (
                        <Box
                          component="img"
                          src={section.heroImage}
                          alt=""
                          sx={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      )}
                      {done && (
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            bgcolor: "rgba(0,0,0,0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <CheckCircleIcon
                            sx={{ fontSize: 32, color: "white" }}
                          />
                        </Box>
                      )}
                    </Box>

                    {/* Text */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: "1rem",
                          lineHeight: 1.3,
                          mb: 0.5,
                        }}
                        noWrap
                      >
                        {section.title || `Section ${index + 1}`}
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 0.5,
                        }}
                      >
                        <Typography
                          sx={{ color: "text.disabled", fontSize: "0.75rem" }}
                        >
                          Section {index + 1}
                        </Typography>
                        {section.isModuleQuiz && (
                          <Chip
                            label="Module quiz"
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ height: 20, fontSize: "0.7rem" }}
                          />
                        )}
                      </Box>
                      {section.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {section.description}
                        </Typography>
                      )}
                    </Box>

                    {/* Action buttons */}
                    {done ? (
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          flexShrink: 0,
                          width: { xs: "100%", sm: "auto" },
                          justifyContent: "flex-end",
                        }}
                      >
                        <Button
                          variant="outlined"
                          endIcon={<VisibilityOutlined />}
                          onClick={() => setSelectedSectionId(section.id)}
                          sx={{ borderRadius: 999 }}
                        >
                          Review
                        </Button>
                        <Button
                          variant="contained"
                          endIcon={<CheckCircleIcon />}
                          disabled
                          sx={{ borderRadius: 999 }}
                        >
                          Complete
                        </Button>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          display: "flex",
                          flexShrink: 0,
                          width: { xs: "100%", sm: "auto" },
                          justifyContent: "flex-end",
                        }}
                      >
                        <Button
                          variant="contained"
                          endIcon={<ChevronRightIcon />}
                          onClick={() => setSelectedSectionId(section.id)}
                          sx={{ borderRadius: 999 }}
                        >
                          Attempt Now
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </Box>
      ) : (
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Box
            sx={{ "& img": { maxWidth: "100%", height: "auto" } }}
            dangerouslySetInnerHTML={{ __html: module.content }}
          />
        </Paper>
      )}

      {hasQuiz && !otherSectionsComplete && !isCompleted && (
        <Alert severity="warning">
          Complete all other sections before attempting the module-level quiz.
        </Alert>
      )}
      {!hasQuiz && !otherSectionsComplete && !isCompleted && (
        <Alert severity="warning">
          Work through every section before marking this module complete.
        </Alert>
      )}
      {hasQuiz && otherSectionsComplete && quizPending && !isCompleted && (
        <Alert severity="info">
          Your module-level quiz has been submitted and is awaiting review by an
          admin.
        </Alert>
      )}
      {hasQuiz && quizPassed === false && !isCompleted && (
        <Alert severity="error">
          Your module-level quiz submission was not passed. Update your answers
          in that section, then submit again below.
        </Alert>
      )}

      <Box
        sx={{
          display: "flex",
          gap: 2,
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        {isCompleted ? (
          <Typography
            sx={{ color: "success.main", fontWeight: 600, alignSelf: "center" }}
          >
            ✓ Completed
            {progress?.completedAt &&
              ` on ${new Date(progress.completedAt).toLocaleDateString()}`}
          </Typography>
        ) : hasQuiz ? (
          quizPending ? (
            <Typography sx={{ color: "text.secondary", fontWeight: 500 }}>
              Awaiting review by an admin
            </Typography>
          ) : (
            <Button
              variant="contained"
              onClick={handleSubmitQuizForReview}
              disabled={
                !otherSectionsComplete ||
                submitQuizReview.isLoading ||
                moduleQuizBlockIds.some((bid) => answers[bid] === undefined)
              }
            >
              {submitQuizReview.isLoading
                ? "Submitting…"
                : "Submit Quiz for Review"}
            </Button>
          )
        ) : confirming ? (
          <>
            <Button onClick={() => setConfirming(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleMarkComplete}
              disabled={saving}
            >
              {saving ? "Submitting…" : "Yes, complete"}
            </Button>
          </>
        ) : (
          // Same bar the quiz path sets above: a module is only complete
          // once its sections are. Without this, a module with no
          // module-level quiz could be signed off unread.
          <Button
            variant="contained"
            onClick={() => setConfirming(true)}
            disabled={!otherSectionsComplete}
          >
            Mark as complete
          </Button>
        )}
      </Box>

      {saveErrorToast}
    </Box>
  );
}
