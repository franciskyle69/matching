(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect } = React;
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
      setActiveTab,
      setSessionsPairMenteeId,
    } = ctx;
    const Spinner = LoadingSpinner;
    const MatchingLoading = MatchingLoadingAnimation;

    const isMentee = user.role === "mentee";
    const menteeQuestionnaireCompleted = !!(user.mentee_questionnaire_completed ?? user.questionnaire_completed);

    useEffect(() => {
      if (!isMentee) return;
      if (!menteeQuestionnaireCompleted) return;
      if (menteeRecLoading) return;
      if (menteeRecommendations && menteeRecommendations.length > 0) return;
      loadMenteeRecommendations();
    }, [isMentee, menteeQuestionnaireCompleted, menteeRecLoading, menteeRecommendations, loadMenteeRecommendations]);

    return (
      <div className="card">
        <h1 className="page-title">Matching</h1>
        <p className="page-subtitle">
          {isMentee
            ? "Personalized mentor recommendations based on your questionnaire. Choose a mentor to start your session—we match you by subjects and topics you care about."
            : "Run the model to get mentor–mentee pairs."}
        </p>
        {user.role !== "mentee" && (
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

        {user.role !== "mentee" && (
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

        {user.role !== "mentee" && matchingLoading && (
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

        {user.role !== "mentee" && matchingResults.length === 0 && !matchingLoading && (
          <div className="matching-empty">No results yet. Click "Run matching".</div>
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
          if (menteeRecLoading) {
            return (
              <div className="loading-block">
                <Spinner />
                <p className="muted">Loading your mentor recommendations…</p>
              </div>
            );
          }

          const recs = (menteeRecommendations || []).slice().sort((a, b) => {
            if (chosenMentorId) {
              const aChosen = a.mentor_id === chosenMentorId;
              const bChosen = b.mentor_id === chosenMentorId;
              if (aChosen && !bChosen) return -1;
              if (bChosen && !aChosen) return 1;
            }
            return (b.score ?? 0) - (a.score ?? 0);
          });

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
                <p className="muted">
                  Try updating your matching questionnaire to improve your matches.
                </p>
                <div className="btn-row" style={{ marginTop: "12px" }}>
                  <button type="button" className="btn secondary" onClick={() => setActiveTab("settings")}>
                    Review questionnaire
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
                const isRequested = chosenMentorId === match.mentor_id;

                const chips = [];
                if (mentor.program) chips.push(mentor.program);
                if (mentor.year_level) chips.push(`Year ${mentor.year_level}`);
                const mentorSubjects = (mentor.subjects && mentor.subjects.length ? mentor.subjects : d.mentor_subjects || []);
                if (mentorSubjects.length > 0) chips.push(`Strong in: ${mentorSubjects[0]}`);

                return (
                  <div
                    key={match.mentor_id + "-" + idx}
                    className={"match-card match-card-mentee-list" + (isRequested ? " match-card-requested" : "")}
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
                      {isRequested && <span className="match-request-badge">Requested</span>}
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
                      {commonSubjects.length > 0 && (
                        <p className="match-reason">
                          <strong>Why this match:</strong> {commonSubjects.join(", ")}
                        </p>
                      )}
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
                    className="btn secondary small"
                    disabled={menteeRecLoading}
                    onClick={() => loadMenteeRecommendations(30)}
                    style={{ fontSize: "12px", opacity: 0.8 }}
                  >
                    {menteeRecLoading ? "Loading more mentors…" : "See more mentors"}
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {user.role !== "mentee" && matchingResults.length > 0 && (
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
