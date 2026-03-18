(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useRef, useState } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const PLACEHOLDER_AVATAR = window.DashboardApp.PLACEHOLDER_AVATAR || "";
  const { formatMatchScore, formatDate, LoadingSpinner, MatchingLoadingAnimation } = Utils;

  function MatchingPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const {
      user,
      matchingLoading,
      matchingMode,
      setMatchingMode,
      matchingMinScore,
      setMatchingMinScore,
      runMatching,
      matchingResults,
      lastRunMode,
      lastRunMinScore,
      menteeRecLoading,
      menteeRecommendations,
      menteeRecMeta,
      loadMenteeRecommendations,
      chooseMentor,
      chosenMentorId,
      mentorRequestsLoading,
      mentorRequests,
      loadMentorRequests,
      acceptMentee,
      acceptMenteeLoading,
      myMentor,
      loadMyMentor,
      menteeMatching,
      menteeRecUpdating,
      setActiveTab,
      setSessionsPairMenteeId,
      setViewedMentorProfile,
      setMentorProfileHashId,
    } = ctx;
    const Spinner = LoadingSpinner;
    const MatchingLoading = MatchingLoadingAnimation;
    const didAutoLoadRecsRef = useRef(false);
    const [showMoreMentors, setShowMoreMentors] = useState(false);
    const [selectedMentorDetails, setSelectedMentorDetails] = useState(null);
    const [expandedMentorId, setExpandedMentorId] = useState(null);

    const isMentee = user.role === "mentee";
    const menteeQuestionnaireCompleted = !!(user.mentee_questionnaire_completed ?? user.questionnaire_completed);

    // We currently just display the mentor's own availability ranges.

    const sortedMenteeRecs = (menteeRecommendations || []).slice().sort((a, b) => {
      if (chosenMentorId) {
        const aChosen = a.mentor_id === chosenMentorId;
        const bChosen = b.mentor_id === chosenMentorId;
        if (aChosen && !bChosen) return -1;
        if (bChosen && !aChosen) return 1;
      }
      return (b.score ?? 0) - (a.score ?? 0);
    });

    useEffect(() => {
      // Reset auto-load guard when user/questionnaire context changes.
      didAutoLoadRecsRef.current = false;
    }, [user?.id, isMentee, menteeQuestionnaireCompleted]);

    useEffect(() => {
      if (!isMentee) return;
      if (!menteeQuestionnaireCompleted) return;
      if (menteeRecLoading || menteeRecUpdating) return;
      if (didAutoLoadRecsRef.current) return;
      didAutoLoadRecsRef.current = true;
      loadMenteeRecommendations();
    }, [isMentee, menteeQuestionnaireCompleted, menteeRecLoading, menteeRecUpdating, loadMenteeRecommendations]);

    return (
      <div className="card">
        <h1 className="page-title">
          Matching
          {isMentee && menteeRecUpdating && (
            <span className="matching-updating-badge">Updating…</span>
          )}
        </h1>
        <p className="page-subtitle">
          {isMentee
            ? "Personalized mentor recommendations based on your questionnaire. Choose a mentor to start your session—we match you by subjects and topics you care about."
            : user.role === "mentor"
            ? "View your official mentees and mentee requests."
            : "Run the model to get mentor–mentee pairs."}
        </p>
        {user.role === "staff" && (
          <div className="matching-options">
            <div className="matching-options-row">
              <span className="matching-options-label">Matching type</span>
              <div className="matching-options-radios">
                <label className="matching-radio"><input type="radio" name="matchingMode" checked={matchingMode === "one_to_one"} onChange={() => setMatchingMode("one_to_one")} /><span>One to one</span></label>
                <label className="matching-radio"><input type="radio" name="matchingMode" checked={matchingMode === "group"} onChange={() => setMatchingMode("group")} /><span>Group</span></label>
              </div>
            </div>
            {matchingMode === "group" && (
              <div className="matching-options-row matching-min-score-row">
                <label className="matching-options-label" htmlFor="matchingMinScore">Minimum score</label>
                <input id="matchingMinScore" type="number" min={0} max={1} step={0.05} value={matchingMinScore} onChange={(e) => setMatchingMinScore(parseFloat(e.target.value) || 0.3)} className="matching-min-score-input" />
              </div>
            )}
          </div>
        )}

        {user.role === "staff" && (
          <div className="btn-row" style={{ marginBottom: "20px" }}>
            <button className="btn" onClick={runMatching} disabled={matchingLoading}>
              {matchingLoading ? (
                <span className="loading-inline">
                  <Spinner inline /> Running…
                </span>
              ) : (
                "Run matching"
              )}
            </button>
          </div>
        )}

        {user.role === "staff" && matchingLoading && (
          <MatchingLoading />
        )}

        {isMentee && !menteeQuestionnaireCompleted && (
          <div className="matching-empty">
            <p>
              Complete your matching questionnaire so we can recommend mentors
              based on the subjects you find difficult.
            </p>
            <div className="btn-row" style={{ marginTop: "12px" }}>
              <button type="button" className="btn secondary" onClick={() => setActiveTab("settings")}>
                Open mentee questionnaire
              </button>
            </div>
          </div>
        )}

        {user.role === "staff" && matchingResults.length === 0 && !matchingLoading && (
          <div className="matching-empty">
            <p>No results yet. Click “Run matching”.</p>
            <div className="btn-row" style={{ marginTop: "10px" }}>
              <button type="button" className="btn secondary small" onClick={runMatching}>
                Run matching
              </button>
            </div>
          </div>
        )}

        {user.role === "mentor" && (() => {
          if (mentorRequestsLoading && mentorRequests.length === 0) {
            return (
              <div className="loading-block">
                <Spinner />
                <p className="muted">Loading mentee requests…</p>
              </div>
            );
          }
          if (mentorRequests.length > 0) {
            const accepted = mentorRequests.filter((r) => r.accepted);
            const pending = mentorRequests.filter((r) => !r.accepted);
            return (
              <>
                {accepted.length > 0 && (
                  <div className="match-mentee-list" style={{ marginBottom: "24px" }}>
                    <div className="section-title">My mentees</div>
                    <p className="page-subtitle" style={{ marginTop: "-8px", marginBottom: "12px" }}>
                      Official mentees you accepted. Each has a dedicated Sessions page where you can schedule sessions.
                    </p>
                    {accepted.map((r) => (
                      <div key={r.mentee_id} className="match-card match-card-mentee-list match-card-accepted">
                        <div className="match-card-header">
                          <div className="match-card-main">
                            <p className="match-card-title">Mentee: {r.mentee_username}</p>
                            <div className="notification-time">Accepted {formatDate(r.accepted_at)}</div>
                          </div>
                          <span className="match-request-badge match-request-badge-accepted">Official mentee</span>
                        </div>
                        {(r.mentee_subjects?.length || r.mentee_topics?.length || r.mentee_difficulty_level != null) && (
                          <div className="match-card-body">
                            {r.mentee_subjects?.length > 0 && <p><strong>Subjects:</strong> {r.mentee_subjects.join(", ")}</p>}
                            {r.mentee_topics?.length > 0 && <p><strong>Topics:</strong> {r.mentee_topics.join(", ")}</p>}
                            {r.mentee_difficulty_level != null && <p><strong>Difficulty level:</strong> {r.mentee_difficulty_level}/5</p>}
                          </div>
                        )}
                        <div className="btn-row" style={{ marginTop: "12px" }}>
                          <button type="button" className="btn small" onClick={() => { setSessionsPairMenteeId(r.mentee_id); setActiveTab("sessions"); }}>View sessions with {r.mentee_username}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="match-mentee-list" style={{ marginBottom: "24px" }}>
                  <div className="section-title">Mentees who requested you</div>
                  <p className="page-subtitle" style={{ marginTop: "-8px", marginBottom: "12px" }}>
                    Accept a request to make them your official mentee; then you can schedule sessions in Sessions.
                  </p>
                  {pending.length === 0 ? (
                    <p className="muted">No pending requests.</p>
                  ) : (
                    pending.map((r) => (
                      <div key={r.mentee_id} className="match-card match-card-mentee-list">
                        <div className="match-card-header">
                          <div className="match-card-main">
                            <p className="match-card-title">Mentee: {r.mentee_username}</p>
                            <div className="notification-time">{formatDate(r.created_at)}</div>
                          </div>
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => acceptMentee(r.mentee_id)}
                            disabled={acceptMenteeLoading === r.mentee_id}
                          >
                            {acceptMenteeLoading === r.mentee_id ? "Accepting…" : "Accept mentee"}
                          </button>
                        </div>
                        <div className="match-card-body">
                          {r.mentee_subjects?.length > 0 && <p><strong>Subjects:</strong> {r.mentee_subjects.join(", ")}</p>}
                          {r.mentee_topics?.length > 0 && <p><strong>Topics:</strong> {r.mentee_topics.join(", ")}</p>}
                          {r.mentee_difficulty_level != null && <p><strong>Difficulty level:</strong> {r.mentee_difficulty_level}/5</p>}
                          {(!r.mentee_subjects?.length && !r.mentee_topics?.length && (r.mentee_difficulty_level == null)) && (
                            <p className="muted">No subjects or difficulty specified.</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            );
          }
          return null;
        })()}

        {isMentee && myMentor && (
          <div className="match-mentee-list" style={{ marginBottom: "24px" }}>
            <div className="section-title">Your mentor</div>
            <p className="page-subtitle" style={{ marginTop: "-8px", marginBottom: "12px" }}>
              Your official mentor. Schedule sessions together in Sessions.
            </p>
            <div className="match-card match-card-mentee-list match-card-accepted">
              <div className="match-card-header">
                <div className="match-card-main">
                  <p className="match-card-title">Mentor: {myMentor.username}</p>
                  {myMentor.accepted_at && <div className="notification-time">Accepted {formatDate(myMentor.accepted_at)}</div>}
                </div>
                <span className="match-request-badge match-request-badge-accepted">Official mentor</span>
              </div>
              <div className="btn-row" style={{ marginTop: "12px" }}>
                <button type="button" className="btn small" onClick={() => setActiveTab("sessions")}>Go to Sessions</button>
              </div>
            </div>
          </div>
        )}

        {isMentee && menteeQuestionnaireCompleted && (() => {
          if (menteeRecLoading && sortedMenteeRecs.length === 0) {
            return (
              <MatchingLoading />
            );
          }

          const recs = sortedMenteeRecs;

          if (recs.length === 0) {
            const emptyMessage = (menteeRecMeta && menteeRecMeta.message) || "No mentor recommendations yet.";
            const suggestedSlots = (menteeRecMeta && Array.isArray(menteeRecMeta.suggested_time_slots)) ? menteeRecMeta.suggested_time_slots : [];
            return (
              <div className="matching-empty">
                <p>{emptyMessage}</p>
                {suggestedSlots.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <p className="muted" style={{ marginBottom: "6px" }}>Suggested available mentor times:</p>
                    <ul style={{ margin: 0, paddingLeft: "18px", textAlign: "left", display: "inline-block" }}>
                      {suggestedSlots.map((slot) => <li key={slot}>{slot}</li>)}
                    </ul>
                  </div>
                )}
                <p className="muted" style={{ marginTop: "8px" }}>
                  Try adjusting your availability or selecting more subjects in your matching questionnaire.
                </p>
                <div className="btn-row" style={{ marginTop: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setActiveTab("settings")}
                  >
                    Adjust availability
                  </button>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setActiveTab("settings")}
                  >
                    Select more subjects
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="match-mentee-list">
              <div className="section-title">Your mentor matches</div>
              {recs.map((match, idx) => {
                const mentor = match.mentor || {};
                const d = match.match_details || {};
                const { percentage, label, tier } = formatMatchScore(match.score);
                const commonSubjects = d.common_subjects || [];
                const commonTopics = d.common_topics || [];
                const isRequested = chosenMentorId === match.mentor_id;

                const chips = [];
                if (mentor.program) chips.push(mentor.program);
                if (mentor.year_level) chips.push(`Year ${mentor.year_level}`);
                const mentorSubjects = (mentor.subjects && mentor.subjects.length ? mentor.subjects : d.mentor_subjects || []);
                if (mentorSubjects.length > 0) chips.push(`Strong in: ${mentorSubjects[0]}`);
                const mentorTopics = (mentor.topics && mentor.topics.length ? mentor.topics : d.mentor_topics || []);
                const mentorAvailability = Array.isArray(mentor.availability) ? mentor.availability.join(", ") : "";
                const isExpanded = expandedMentorId === match.mentor_id;

                const whyReasons = [];
                if (commonSubjects.length) {
                  whyReasons.push(`Same subjects: ${commonSubjects.join(", ")}`);
                }
                if (commonTopics.length) {
                  whyReasons.push(`Matching topics: ${commonTopics.join(", ")}`);
                }
                if (mentorAvailability) {
                  whyReasons.push(`Compatible schedule: ${mentorAvailability}`);
                }
                if (whyReasons.length === 0) {
                  whyReasons.push(`Good overall fit based on your questionnaire answers.`);
                }

                return (
                  <div
                    key={match.mentor_id + "-" + idx}
                    className={
                      "match-card match-card-mentee-list" +
                      (isRequested ? " match-card-requested" : "") +
                      (isExpanded ? " match-card-expanded" : "")
                    }
                  >
                    <div
                      className="match-card-header match-card-header-clickable"
                      onClick={() => {
                        setExpandedMentorId(isExpanded ? null : match.mentor_id);
                      }}
                    >
                      <div className="match-card-main">
                        <div className="match-card-title-row">
                          <img src={mentor.avatar_url || PLACEHOLDER_AVATAR} alt={match.mentor_username} className="match-column-avatar" />
                          <div>
                            <p className="match-card-title">Mentor: {match.mentor_username}</p>
                            {mentor.role && <p className="match-card-subtitle">{mentor.role}</p>}
                          </div>
                        </div>
                      </div>
                      <div className="match-card-header-right">
                        <div>
                          <span className={"match-card-score match-score-badge match-score-tier-" + tier}>
                            {percentage}% · {label}
                          </span>
                          <div className="match-score-bar-inline">
                            <div
                              className={"match-score-bar-fill match-score-tier-" + tier}
                              style={{ width: Math.min(100, percentage) + "%" }}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn secondary small match-card-connect-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isRequested) chooseMentor(match.mentor_id);
                          }}
                          disabled={isRequested}
                        >
                          {isRequested ? "Requested" : "Connect"}
                        </button>
                        {isRequested && <span className="match-request-badge">Requested</span>}
                      </div>
                    </div>
                    <div className="match-card-body">
                      {chips.length > 0 && (
                        <div className="match-meta-chips">
                          {chips.map((text, i) => <span key={i} className="match-chip">{text}</span>)}
                        </div>
                      )}
                      {(mentor.subjects || d.mentor_subjects || []).length > 0 && (
                        <p>
                          <strong>Subjects:</strong>{" "}
                          {(mentor.subjects && mentor.subjects.length ? mentor.subjects : d.mentor_subjects || []).join(", ") || "—"}
                        </p>
                      )}
                      {mentorTopics.length > 0 && (
                        <p>
                          <strong>Topics:</strong>{" "}
                          {mentorTopics.join(", ")}
                        </p>
                      )}
                      {mentorAvailability && (
                        <p>
                          <strong>When you can meet:</strong>{" "}
                          {mentorAvailability}
                        </p>
                      )}
                      <div className="match-reason">
                        <p className="match-why-title">Why this match</p>
                        <ul className="match-why-list">
                          {whyReasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="btn-row" style={{ marginTop: "8px", justifyContent: "flex-start" }}>
                        <button
                          type="button"
                          className="btn secondary small"
                          style={{ borderRadius: "999px", paddingInline: "14px" }}
                          onClick={() => {
                            const mentorUserId = match.mentor && (match.mentor.user_id != null) ? match.mentor.user_id : null;
                            if (typeof setMentorProfileHashId === "function" && mentorUserId != null) {
                              setMentorProfileHashId(mentorUserId);
                            }
                            if (typeof setViewedMentorProfile === "function") {
                              setViewedMentorProfile(match);
                            }
                            setActiveTab("profile");
                          }}
                        >
                          View profile
                        </button>
                      </div>
                      <div className="btn-row" style={{ marginTop: "12px" }}>
                        <button type="button" className="btn small" onClick={() => chooseMentor(match.mentor_id)} disabled={isRequested}>
                          {isRequested ? "Requested" : "Choose this mentor"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {recs.length >= 1 && (
                <div className="btn-row" style={{ marginTop: "8px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={menteeRecLoading}
                    onClick={() => {
                      setShowMoreMentors(true);
                      loadMenteeRecommendations(30);
                    }}
                    style={{ fontSize: "13px", padding: "8px 16px", borderRadius: "999px" }}
                  >
                    {menteeRecLoading ? "Loading more mentors…" : "View more mentors"}
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {isMentee && showMoreMentors && (
          <div
            className="mentee-info-modal-backdrop"
            onClick={() => setShowMoreMentors(false)}
            role="dialog"
            aria-modal="true"
            aria-label="More mentor matches"
          >
            <div className="card mentee-info-modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="page-title">More mentor matches</h2>
              <p className="page-subtitle">
                Scroll to explore additional mentors that fit your subjects and topics.
              </p>
              <div style={{ maxHeight: "360px", overflowY: "auto", marginTop: "12px" }}>
                {sortedMenteeRecs.length === 0 && !menteeRecLoading && (
                  <p className="muted">No additional mentors to show right now.</p>
                )}
                {sortedMenteeRecs.map((match, idx) => {
                  const mentor = match.mentor || {};
                  const d = match.match_details || {};
                  const { percentage, label, tier } = formatMatchScore(match.score);
                  const commonSubjects = d.common_subjects || [];
                  const commonTopics = d.common_topics || [];
                  const isRequested = chosenMentorId === match.mentor_id;
                  const mentorSubjects = (mentor.subjects && mentorSubjects.length ? mentor.subjects : d.mentor_subjects || []);
                  const mentorTopics = (mentor.topics && mentor.topics.length ? mentor.topics : d.mentor_topics || []);
                  const mentorAvailability = Array.isArray(mentor.availability) ? mentor.availability.join(", ") : "";

                  let whySentence = `This mentor is a ${label.toLowerCase()} match based on your subjects, topics, and difficulty level.`;
                  if (commonSubjects.length && commonTopics.length) {
                    whySentence = `You both selected subjects like ${commonSubjects.join(", ")} and topics such as ${commonTopics.join(", ")}, so their strengths line up well with what you want mentoring on.`;
                  } else if (commonSubjects.length) {
                    whySentence = `You both focus on ${commonSubjects.join(", ")}, which matches the subjects you said you need mentoring in.`;
                  } else if (commonTopics.length) {
                    whySentence = `You both highlighted topics like ${commonTopics.join(", ")}, so this mentor is aligned with the areas you want to improve.`;
                  }

                  return (
                    <div
                      key={"modal-" + match.mentor_id + "-" + idx}
                      className={"match-card match-card-mentee-list" + (isRequested ? " match-card-requested" : "")}
                      style={{ marginBottom: "12px" }}
                    >
                      <div className="match-card-header">
                        <div className="match-card-main">
                          <div className="match-card-title-row">
                            <img src={mentor.avatar_url || PLACEHOLDER_AVATAR} alt={match.mentor_username} className="match-column-avatar" />
                            <div>
                              <p className="match-card-title">Mentor: {match.mentor_username}</p>
                              {mentor.role && <p className="match-card-subtitle">{mentor.role}</p>}
                            </div>
                          </div>
                        </div>
                        <span className={"match-card-score match-score-badge match-score-tier-" + tier}>
                          {percentage}% · {label}
                        </span>
                      </div>
                      <div className="match-card-body">
                        {(mentorSubjects || []).length > 0 && (
                          <p>
                            <strong>Subjects:</strong>{" "}
                            {mentorSubjects.join(", ") || "—"}
                          </p>
                        )}
                        {mentorTopics.length > 0 && (
                          <p>
                            <strong>Topics:</strong>{" "}
                            {mentorTopics.join(", ")}
                          </p>
                        )}
                        {mentorAvailability && (
                          <p>
                            <strong>When you can meet:</strong>{" "}
                            {mentorAvailability}
                          </p>
                        )}
                        <p className="match-reason">
                          <strong>Why this match:</strong> {whySentence}
                        </p>
                        <div className="btn-row" style={{ marginTop: "8px" }}>
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => {
                              chooseMentor(match.mentor_id);
                              setShowMoreMentors(false);
                            }}
                            disabled={isRequested}
                          >
                            {isRequested ? "Requested" : "Choose this mentor"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {menteeRecLoading && (
                  <div style={{ marginTop: "8px" }}>
                    <MatchingLoading />
                  </div>
                )}
              </div>
              <div className="btn-row" style={{ marginTop: "16px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setShowMoreMentors(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {isMentee && selectedMentorDetails && (
          <div
            className="mentee-info-modal-backdrop"
            onClick={() => setSelectedMentorDetails(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Mentor profile"
          >
            <div className="card mentee-info-modal mentor-info-modal" onClick={(e) => e.stopPropagation()}>
              {(() => {
                const match = selectedMentorDetails;
                const mentor = match.mentor || {};
                const d = match.match_details || {};
                const { percentage, label, tier } = formatMatchScore(match.score);
                const mentorSubjects = (mentor.subjects && mentor.subjects.length ? mentor.subjects : d.mentor_subjects || []);
                const mentorTopics = (mentor.topics && mentor.topics.length ? mentor.topics : d.mentor_topics || []);
                return (
                  <>
                    <div className="match-card-header" style={{ marginBottom: "8px" }}>
                      <div className="match-card-main">
                        <div className="match-card-title-row">
                          <img src={mentor.avatar_url || PLACEHOLDER_AVATAR} alt={match.mentor_username} className="match-column-avatar" />
                          <div>
                            <h2 className="page-title" style={{ marginBottom: 2 }}>Mentor profile</h2>
                            <p className="page-subtitle" style={{ marginBottom: 2 }}>{match.mentor_username}</p>
                            {mentor.role && <p className="page-subtitle" style={{ marginBottom: 0 }}>{mentor.role}</p>}
                          </div>
                        </div>
                      </div>
                      <span className={"match-card-score match-score-badge match-score-tier-" + tier}>
                        {percentage}% · {label}
                      </span>
                    </div>
                    <p className="page-subtitle">
                      A quick snapshot of this mentor&apos;s profile, availability, and capacity.
                    </p>
                    <div className="form-grid" style={{ marginTop: "8px" }}>
                      <div>
                        <p><strong>Biological sex:</strong> {mentor.gender || "—"}</p>
                        {mentor.expertise_level != null && (
                          <p><strong>Expertise level:</strong> {mentor.expertise_level}/5</p>
                        )}
                        {mentor.capacity != null && (
                          <p><strong>Capacity:</strong> {mentor.capacity} mentees</p>
                        )}
                      </div>
                      <div>
                        {(mentor.availability || []).length > 0 && (
                          <p>
                            <strong>Availability:</strong>{" "}
                            {mentor.availability.join(", ")}
                          </p>
                        )}
                        {mentorSubjects.length > 0 && (
                          <p>
                            <strong>Subjects:</strong>{" "}
                            {mentorSubjects.join(", ")}
                          </p>
                        )}
                        {mentorTopics.length > 0 && (
                          <p>
                            <strong>Topics:</strong>{" "}
                            {mentorTopics.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="btn-row" style={{ marginTop: "16px", justifyContent: "space-between" }}>
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => setSelectedMentorDetails(null)}
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => {
                          chooseMentor(match.mentor_id);
                          setSelectedMentorDetails(null);
                        }}
                      >
                        Choose this mentor
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {user.role === "staff" && matchingResults.length > 0 && (
          <>
            <div className="section-title">
              Results ({matchingResults.length} pairs)
              {lastRunMode === "group" && lastRunMinScore != null && <span className="matching-results-badge">Group (min {formatMatchScore(lastRunMinScore).percentage}%)</span>}
              {lastRunMode === "one_to_one" && <span className="matching-results-badge">One to one</span>}
            </div>
            {matchingResults.map((row, idx) => {
              const d = row.match_details || {};
              const mentor = row.mentor || {};
              const mentee = row.mentee || {};
              return (
                <div key={row.mentor_id + "-" + row.mentee_id} className="match-card">
                  <div className="match-card-header">
                    <span className="match-card-pair">Pair {idx + 1}</span>
                    <span className={"match-card-score match-score-badge match-score-tier-" + formatMatchScore(row.score).tier}>
                      {formatMatchScore(row.score).percentage}% · {formatMatchScore(row.score).label}
                    </span>
                  </div>
                  <div className="match-card-columns">
                    <div className="match-column">
                      <div className="match-column-header">
                        <img src={mentor.avatar_url || PLACEHOLDER_AVATAR} alt={row.mentor_username} className="match-column-avatar" />
                        <h4>Mentor: {row.mentor_username}</h4>
                      </div>
                      {mentor.role && <p>Role: {mentor.role}</p>}
                      {(mentor.subjects || d.mentor_subjects || []).length > 0 && <p><strong>Subjects:</strong> {(mentor.subjects && mentor.subjects.length) ? mentor.subjects.join(", ") : (d.mentor_subjects || []).join(", ") || "—"}</p>}
                      {(mentor.topics || d.mentor_topics || []).length > 0 && <p><strong>Topics:</strong> {(mentor.topics && mentor.topics.length) ? mentor.topics.join(", ") : (d.mentor_topics || []).join(", ") || "—"}</p>}
                    </div>
                    <div className="match-column">
                      <div className="match-column-header">
                        <img src={mentee.avatar_url || PLACEHOLDER_AVATAR} alt={row.mentee_username} className="match-column-avatar" />
                        <h4>Mentee: {row.mentee_username}</h4>
                      </div>
                      {(mentee.subjects || d.mentee_subjects || []).length > 0 && <p><strong>Subjects:</strong> {(mentee.subjects && mentee.subjects.length) ? mentee.subjects.join(", ") : (d.mentee_subjects || []).join(", ") || "—"}</p>}
                      {(mentee.topics || d.mentee_topics || []).length > 0 && <p><strong>Topics:</strong> {(mentee.topics && mentee.topics.length) ? mentee.topics.join(", ") : (d.mentee_topics || []).join(", ") || "—"}</p>}
                    </div>
                  </div>
                  <div className="match-reason">
                    <strong>Why this match:</strong>{(d.common_subjects || []).length > 0 || (d.common_topics || []).length > 0 ? <><span> Shared subjects: {(d.common_subjects || []).join(", ")}. </span><span>Shared topics: {(d.common_topics || []).join(", ")}.</span></> : <span className="muted"> {formatMatchScore(row.score).label}.</span>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.matching = MatchingPage;
})();
