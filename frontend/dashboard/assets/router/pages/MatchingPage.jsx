(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useMemo, useRef, useState, useCallback } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const PLACEHOLDER_AVATAR = window.DashboardApp.PLACEHOLDER_AVATAR || "";
  const formatSlotList =
    (window.DashboardApp.Availability &&
      window.DashboardApp.Availability.formatSlotList) ||
    ((slots) => (Array.isArray(slots) ? slots.join(", ") : ""));
  const formatSlotLabel =
    (window.DashboardApp.Availability &&
      window.DashboardApp.Availability.formatSlotLabel) ||
    ((slot) => String(slot || ""));
  const {
    formatMatchScore,
    LoadingSpinner,
    MatchingLoadingAnimation,
    MentorRoleBadge,
    getAvatarInitials: getAvatarInitialsFromUtils,
  } = Utils;
  const intersectSlots =
    (window.DashboardApp.Availability &&
      window.DashboardApp.Availability.intersectSlots) ||
    null;
  const MentorProfileCard = window.DashboardApp.MentorProfileCard;

  function getAvatarInitials(name, fallback) {
    if (typeof getAvatarInitialsFromUtils === "function") {
      return getAvatarInitialsFromUtils(name, fallback);
    }
    const source = String(name || fallback || "").trim();
    if (!source) return "?";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function MatchPersonAvatar({ name, url, className }) {
    const src = String(url || "").trim();
    const hasPhoto = src && src !== PLACEHOLDER_AVATAR;
    if (hasPhoto) {
      return <img src={src} alt={name} className={className} />;
    }
    return (
      <span
        className={(className || "") + " match-column-avatar-fallback"}
        role="img"
        aria-label={name || "Profile"}
      >
        {getAvatarInitials(name)}
      </span>
    );
  }

  function OfficialMentorSpotlight({
    myMentor,
    menteeMatching,
  }) {
    const displayName = myMentor.display_name || myMentor.username || "Mentor";
    if (!MentorProfileCard) return null;
    return (
      <div className="match-spotlight-section matching-section-block">
        <div className="section-title">Your mentor</div>
        <p className="page-subtitle matching-section-subtitle">
          Your official mentor. View announcements and stay in touch through the
          dashboard.
        </p>
        <MentorProfileCard
          person={myMentor}
          displayName={displayName}
          email={myMentor.email}
          score={myMentor.score}
          matchDetails={myMentor.match_details}
          variant="hero"
          kind="mentor"
          isOfficial
          menteeMatching={menteeMatching}
          savedId={myMentor.user_id || myMentor.id}
        />
      </div>
    );
  }

  function parseMentorMatchRow(match) {
    const mentor = match.mentor || {};
    const displayName =
      match.mentor_display_name || match.mentor_username || "Mentor";
    return { mentor, displayName };
  }

  function MentorMatchCard({
    match,
    myMentor,
    chosenMentorId,
    unavailableMentorIds,
    onRequestPairing,
    onViewProfile,
    compact = false,
    menteeMatching = null,
  }) {
    if (!MentorProfileCard) return null;
    const parsed = parseMentorMatchRow(match);
    const { mentor, displayName } = parsed;
    const isOfficialPair =
      (myMentor && isSameMentorMatch(match, myMentor)) ||
      chosenMentorId === match.mentor_id;
    const isNotAvailable = unavailableMentorIds.includes(match.mentor_id);
    const slotsLeft = Number(match.slots_left ?? mentor.capacity ?? 0);

    return (
      <MentorProfileCard
        person={mentor}
        displayName={displayName}
        email={mentor.email}
        score={match.score}
        matchDetails={match.match_details}
        variant={compact ? "grid" : "grid"}
        kind="mentor"
        isOfficial={isOfficialPair}
        isUnavailable={isNotAvailable}
        menteeMatching={menteeMatching}
        slotsLeft={slotsLeft}
        compact={compact}
        savedId={mentor.user_id || match.mentor_id}
        onRequestPairing={() => onRequestPairing(match.mentor_id)}
        onViewProfile={() => onViewProfile(match)}
      />
    );
  }

  function MentorMatchFilterBar({
    search,
    onSearchChange,
    sort,
    onSortChange,
    subject,
    onSubjectChange,
    availability,
    onAvailabilityChange,
    subjectOptions,
  }) {
    return (
      <div className="matching-card match-filter-bar">
        <div className="match-filter-field">
          <label className="match-filter-label" htmlFor="match-search">
            Search
          </label>
          <input
            id="match-search"
            type="search"
            className="match-filter-input"
            placeholder="Search mentors by name or subject..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="match-filter-field">
          <label className="match-filter-label" htmlFor="match-sort">
            Sort
          </label>
          <select
            id="match-sort"
            className="match-filter-select"
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="score-desc">Match Score (High to Low)</option>
            <option value="score-asc">Match Score (Low to High)</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
        <div className="match-filter-field">
          <label className="match-filter-label" htmlFor="match-subject">
            Subject
          </label>
          <select
            id="match-subject"
            className="match-filter-select"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
          >
            <option value="">All subjects</option>
            {subjectOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="match-filter-field">
          <label className="match-filter-label" htmlFor="match-availability">
            Availability
          </label>
          <select
            id="match-availability"
            className="match-filter-select"
            value={availability}
            onChange={(e) => onAvailabilityChange(e.target.value)}
          >
            <option value="">Any availability</option>
            <option value="compatible">Compatible schedule</option>
          </select>
        </div>
      </div>
    );
  }

  function isSameMentorMatch(match, mentorRef) {
    if (!mentorRef || !match) return false;
    const mentorProfileId = Number(match.mentor_id);
    if (
      mentorRef.id != null &&
      !Number.isNaN(mentorProfileId) &&
      Number(mentorRef.id) === mentorProfileId
    ) {
      return true;
    }
    const matchUserId =
      match.mentor && match.mentor.user_id != null
        ? Number(match.mentor.user_id)
        : null;
    const mentorUserId =
      mentorRef.user_id != null ? Number(mentorRef.user_id) : null;
    return (
      matchUserId != null &&
      mentorUserId != null &&
      matchUserId === mentorUserId
    );
  }

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
      myMentor,
      loadMyMentor,
      menteeMatching,
      menteeRecUpdating,
      setActiveTab,
      setViewedMentorProfile,
      setMentorProfileHashId,
      loadUserProfile,
    } = ctx;
    const Spinner = LoadingSpinner;
    const MatchingLoading = MatchingLoadingAnimation;
    const didAutoLoadRecsRef = useRef(false);
    const [showMoreMentors, setShowMoreMentors] = useState(false);
    const [selectedMentorDetails, setSelectedMentorDetails] = useState(null);
    const [unavailableMentorIds, setUnavailableMentorIds] = useState([]);
    const [matchSearch, setMatchSearch] = useState("");
    const [matchSort, setMatchSort] = useState("score-desc");
    const [matchSubjectFilter, setMatchSubjectFilter] = useState("");
    const [matchAvailabilityFilter, setMatchAvailabilityFilter] = useState("");

    const isMentee = user.role === "mentee";
    const menteeQuestionnaireCompleted = !!(
      user.mentee_questionnaire_completed ?? user.questionnaire_completed
    );

    // We currently just display the mentor's own availability ranges.

    const sortedMenteeRecs = (menteeRecommendations || [])
      .slice()
      .sort((a, b) => {
        if (myMentor && isSameMentorMatch(a, myMentor)) return 1;
        if (myMentor && isSameMentorMatch(b, myMentor)) return -1;
        if (chosenMentorId) {
          const aChosen = a.mentor_id === chosenMentorId;
          const bChosen = b.mentor_id === chosenMentorId;
          if (aChosen && !bChosen) return -1;
          if (bChosen && !aChosen) return 1;
        }
        return (b.score ?? 0) - (a.score ?? 0);
      });

    const visibleMenteeRecs = useMemo(() => {
      return sortedMenteeRecs.filter((match) => {
        if (myMentor && isSameMentorMatch(match, myMentor)) return false;
        if (
          chosenMentorId != null &&
          Number(match.mentor_id) === Number(chosenMentorId)
        ) {
          return false;
        }
        return true;
      });
    }, [sortedMenteeRecs, myMentor, chosenMentorId]);

    const matchSubjectOptions = useMemo(() => {
      const subjects = new Set();
      visibleMenteeRecs.forEach((match) => {
        const d = match.match_details || {};
        (d.common_subjects || []).forEach((s) => subjects.add(s));
        const mentor = match.mentor || {};
        (mentor.subjects || d.mentor_subjects || []).forEach((s) =>
          subjects.add(s),
        );
      });
      return Array.from(subjects).sort((a, b) =>
        String(a).localeCompare(String(b)),
      );
    }, [visibleMenteeRecs]);

    const filteredMenteeRecs = useMemo(() => {
      let list = visibleMenteeRecs.slice();
      const query = matchSearch.trim().toLowerCase();
      if (query) {
        list = list.filter((match) => {
          const name = (
            match.mentor_display_name ||
            match.mentor_username ||
            ""
          ).toLowerCase();
          const d = match.match_details || {};
          const mentor = match.mentor || {};
          const subjects = [
            ...(d.common_subjects || []),
            ...(mentor.subjects || d.mentor_subjects || []),
          ];
          const topics = [
            ...(d.common_topics || []),
            ...(mentor.topics || d.mentor_topics || []),
          ];
          const haystack = [name, ...subjects, ...topics]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        });
      }
      if (matchSubjectFilter) {
        list = list.filter((match) => {
          const d = match.match_details || {};
          const mentor = match.mentor || {};
          const subjects = [
            ...(d.common_subjects || []),
            ...(mentor.subjects || d.mentor_subjects || []),
          ];
          return subjects.includes(matchSubjectFilter);
        });
      }
      if (matchAvailabilityFilter === "compatible") {
        const menteeSlots = menteeMatching?.availability || [];
        list = list.filter((match) => {
          const mentorSlots = match.mentor?.availability || [];
          if (
            !intersectSlots ||
            !menteeSlots.length ||
            !mentorSlots.length
          ) {
            return false;
          }
          return intersectSlots(menteeSlots, mentorSlots).length > 0;
        });
      }
      list.sort((a, b) => {
        if (matchSort === "score-desc") {
          return (b.score ?? 0) - (a.score ?? 0);
        }
        if (matchSort === "score-asc") {
          return (a.score ?? 0) - (b.score ?? 0);
        }
        if (matchSort === "name") {
          const nameA = (
            a.mentor_display_name ||
            a.mentor_username ||
            ""
          ).toLowerCase();
          const nameB = (
            b.mentor_display_name ||
            b.mentor_username ||
            ""
          ).toLowerCase();
          return nameA.localeCompare(nameB);
        }
        return 0;
      });
      return list;
    }, [
      visibleMenteeRecs,
      matchSearch,
      matchSort,
      matchSubjectFilter,
      matchAvailabilityFilter,
      menteeMatching,
    ]);

    useEffect(() => {
      if (!isMentee) return;
      if (user?.mentee_approved === false) return;
      loadMyMentor();
    }, [isMentee, loadMyMentor, user?.mentee_approved]);

    const lastAutoLoadUserKeyRef = useRef("");

    useEffect(() => {
      const key = `${user?.id || ""}_${isMentee ? "1" : "0"}_${menteeQuestionnaireCompleted ? "1" : "0"}_${user?.mentee_approved ? "1" : "0"}`;
      if (lastAutoLoadUserKeyRef.current !== key) {
        lastAutoLoadUserKeyRef.current = key;
        didAutoLoadRecsRef.current = false;
      }
    }, [user?.id, isMentee, menteeQuestionnaireCompleted, user?.mentee_approved]);

    useEffect(() => {
      if (!isMentee) return;
      if (!menteeQuestionnaireCompleted) return;
      if (user?.mentee_approved === false) return;
      if (didAutoLoadRecsRef.current) return;
      didAutoLoadRecsRef.current = true;
      loadMenteeRecommendations();
    }, [
      isMentee,
      menteeQuestionnaireCompleted,
      loadMenteeRecommendations,
      user?.mentee_approved,
    ]);

    useEffect(() => {
      const recommendationIds = new Set(
        (menteeRecommendations || []).map((item) => item.mentor_id),
      );
      setUnavailableMentorIds((current) =>
        current.filter((id) => recommendationIds.has(id)),
      );
    }, [menteeRecommendations]);

    async function handleChooseMentor(mentorId) {
      const result = await chooseMentor(mentorId);
      if (result?.ok) {
        setUnavailableMentorIds([]);
        return;
      }
      if (result?.code === "mentor_capacity_full") {
        setUnavailableMentorIds((current) =>
          current.includes(mentorId) ? current : [...current, mentorId],
        );
      }
    }

    function openMentorProfileInNewTab(match) {
      const mentorUserId =
        match.mentor && match.mentor.user_id != null
          ? match.mentor.user_id
          : null;
      if (mentorUserId == null || typeof window === "undefined") return;
      const profileUrl = `${window.location.origin}${window.location.pathname}#profile/mentor/${mentorUserId}`;
      window.open(profileUrl, "_blank", "noopener,noreferrer");
    }

    return (
      <div
        className={
          isMentee
            ? "home-dashboard-space matching-page matching-page--mentee page-shell"
            : "home-dashboard-space matching-page matching-page--mentor page-shell"
        }
      >
        <div className="page-shell-head">
          <div>
            <h1 className="page-title">
              Matching
              {isMentee && menteeRecUpdating && (
                <span className="matching-updating-badge">Updating…</span>
              )}
            </h1>
            <p className="page-subtitle">
              {isMentee
                ? "Personalized mentor recommendations based on your mentoring preferences. Choose a mentor to request a pairing—we match you by subjects and topics you care about."
                : user.role === "mentor"
                  ? "View your official mentees. New mentee requests are auto-accepted when you have available slots."
                  : "Run the model to get mentor–mentee pairs."}
            </p>
          </div>
        </div>
        {user.role === "staff" && (
          <div className="matching-options">
            <div className="matching-options-row">
              <span className="matching-options-label">Matching type</span>
              <div className="matching-options-radios">
                <label className="matching-radio">
                  <input
                    type="radio"
                    name="matchingMode"
                    checked={matchingMode === "one_to_one"}
                    onChange={() => setMatchingMode("one_to_one")}
                  />
                  <span>One to one</span>
                </label>
                <label className="matching-radio">
                  <input
                    type="radio"
                    name="matchingMode"
                    checked={matchingMode === "group"}
                    onChange={() => setMatchingMode("group")}
                  />
                  <span>Group</span>
                </label>
              </div>
            </div>
            {matchingMode === "group" && (
              <div className="matching-options-row matching-min-score-row">
                <label
                  className="matching-options-label"
                  htmlFor="matchingMinScore"
                >
                  Minimum score
                </label>
                <input
                  id="matchingMinScore"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={matchingMinScore}
                  onChange={(e) =>
                    setMatchingMinScore(parseFloat(e.target.value) || 0.3)
                  }
                  className="matching-min-score-input"
                />
              </div>
            )}
          </div>
        )}

        {user.role === "staff" && (
          <div className="btn-row matching-actions-row">
            <button
              className="btn"
              onClick={runMatching}
              disabled={matchingLoading}
            >
              {matchingLoading ? <Spinner inline /> : "Run matching"}
            </button>
          </div>
        )}

        {user.role === "staff" && matchingLoading && <MatchingLoading />}

        {isMentee && !menteeQuestionnaireCompleted && (
          <div className="matching-empty">
            <p>
              Set your mentoring preferences so we can recommend mentors based
              on the subjects you want help with.
            </p>
            <div className="btn-row matching-empty-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setActiveTab("mentoring-preferences")}
              >
                Open mentoring preferences
              </button>
            </div>
          </div>
        )}

        {user.role === "staff" &&
          matchingResults.length === 0 &&
          !matchingLoading && (
            <div className="matching-empty">
              <p>No results yet. Click “Run matching”.</p>
              <div className="btn-row matching-empty-actions">
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={runMatching}
                >
                  Run matching
                </button>
              </div>
            </div>
          )}

        {user.role === "mentor" &&
          (() => {
            if (mentorRequestsLoading && mentorRequests.length === 0) {
              return (
                <Spinner
                  title="Loading mentee requests…"
                  subtitle="Fetching your mentee matches"
                />
              );
            }
            if (mentorRequests.length > 0) {
              const accepted = mentorRequests.filter((r) => r.accepted);
              const pending = mentorRequests.filter((r) => !r.accepted);
              return (
                <>
                  {accepted.length > 0 && (
                    <div className="match-mentee-list matching-section-block">
                      <div className="mentees-section-head">
                        <div>
                          <div className="section-title">My mentees</div>
                          <p className="page-subtitle matching-section-subtitle">
                            Official mentees matched to you. Post announcements
                            or view their matching details below.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() => setActiveTab("mentees")}
                        >
                          View all mentees
                        </button>
                      </div>
                      {accepted.map((r) => (
                        <MentorProfileCard
                          key={r.mentee_id}
                          person={{
                            avatar_url: r.mentee_avatar_url,
                            display_name: r.mentee_display_name,
                            username: r.mentee_username,
                            subjects: r.mentee_subjects,
                            topics: r.mentee_topics,
                            bio: r.mentee_bio,
                            program: r.mentee_program,
                            year_level: r.mentee_year_level,
                            preferred_learning_style:
                              r.mentee_preferred_learning_style,
                            availability: r.mentee_availability,
                            difficulty_level: r.mentee_difficulty_level,
                          }}
                          displayName={
                            r.mentee_display_name || r.mentee_username
                          }
                          email={r.mentee_email}
                          variant="hero"
                          kind="mentee"
                          isOfficial
                          savedId={r.mentee_user_id || r.mentee_id}
                          onViewProfile={
                            r.mentee_user_id
                              ? () => loadUserProfile(r.mentee_user_id)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                  {pending.length > 0 && (
                    <div className="match-mentee-list matching-section-block">
                      <div className="section-title">Not available</div>
                      <p className="page-subtitle matching-section-subtitle">
                        These mentees could not be auto-confirmed because your
                        capacity is full.
                      </p>
                      <div className="match-grid">
                      {pending.map((r) => (
                        <MentorProfileCard
                          key={r.mentee_id}
                          person={{
                            avatar_url: r.mentee_avatar_url,
                            display_name: r.mentee_display_name,
                            username: r.mentee_username,
                            subjects: r.mentee_subjects,
                            topics: r.mentee_topics,
                            bio: r.mentee_bio,
                            program: r.mentee_program,
                            year_level: r.mentee_year_level,
                            preferred_learning_style:
                              r.mentee_preferred_learning_style,
                            availability: r.mentee_availability,
                            difficulty_level: r.mentee_difficulty_level,
                          }}
                          displayName={
                            r.mentee_display_name || r.mentee_username
                          }
                          email={r.mentee_email}
                          variant="grid"
                          kind="mentee"
                          isOfficial={false}
                          isUnavailable
                          compact
                          savedId={r.mentee_user_id || r.mentee_id}
                        />
                      ))}
                      </div>
                    </div>
                  )}
                </>
              );
            }
            return null;
          })()}

        {isMentee && myMentor ? (
          <OfficialMentorSpotlight
            myMentor={myMentor}
            menteeMatching={menteeMatching}
          />
        ) : null}

        {isMentee &&
          menteeQuestionnaireCompleted &&
          (() => {
            if (menteeRecLoading && visibleMenteeRecs.length === 0) {
              return <MatchingLoading />;
            }

            if (visibleMenteeRecs.length === 0) {
              if (myMentor) {
                return null;
              }
              const emptyMessage =
                (menteeRecMeta && menteeRecMeta.message) ||
                "No mentor recommendations yet.";
              const suggestedSlots =
                menteeRecMeta &&
                Array.isArray(menteeRecMeta.suggested_time_slots)
                  ? menteeRecMeta.suggested_time_slots
                  : [];
              return (
                <div className="matching-empty">
                  <p>{emptyMessage}</p>
                  {suggestedSlots.length > 0 && (
                    <div className="matching-suggested-times">
                      <p className="muted matching-suggested-times-label">
                        Suggested available mentor times:
                      </p>
                      <ul className="matching-suggested-times-list">
                        {suggestedSlots.map((slot) => (
                          <li key={slot}>{formatSlotLabel(slot)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="muted matching-suggested-times-note">
                    Try adjusting your availability or selecting more subjects
                    in your mentoring preferences.
                  </p>
                  <div className="btn-row matching-empty-actions matching-empty-actions-wrap">
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
              <div className="match-grid-section">
                <div className="match-grid-head">
                  <div className="section-title">Your mentor matches</div>
                  {visibleMenteeRecs.length >= 1 ? (
                    <div className="btn-row match-mentee-list-head-actions">
                      <button
                        type="button"
                        className="btn secondary small"
                        disabled={menteeRecLoading}
                        onClick={() => {
                          setShowMoreMentors(true);
                          loadMenteeRecommendations(30);
                        }}
                      >
                        {menteeRecLoading
                          ? "Loading more mentors…"
                          : "View more mentors"}
                      </button>
                    </div>
                  ) : null}
                </div>
                <MentorMatchFilterBar
                  search={matchSearch}
                  onSearchChange={setMatchSearch}
                  sort={matchSort}
                  onSortChange={setMatchSort}
                  subject={matchSubjectFilter}
                  onSubjectChange={setMatchSubjectFilter}
                  availability={matchAvailabilityFilter}
                  onAvailabilityChange={setMatchAvailabilityFilter}
                  subjectOptions={matchSubjectOptions}
                />
                {filteredMenteeRecs.length === 0 ? (
                  <div className="matching-card match-filter-empty">
                    <p>No mentors match your current search or filters.</p>
                  </div>
                ) : (
                  <div className="match-grid">
                    {filteredMenteeRecs.map((match, idx) => (
                      <MentorMatchCard
                        key={match.mentor_id + "-" + idx}
                        match={match}
                        myMentor={myMentor}
                        chosenMentorId={chosenMentorId}
                        unavailableMentorIds={unavailableMentorIds}
                        onRequestPairing={handleChooseMentor}
                        onViewProfile={openMentorProfileInNewTab}
                        menteeMatching={menteeMatching}
                      />
                    ))}
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
            <div
              className="card mentee-info-modal modal-paper-container"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="page-title">More mentor matches</h2>
              <p className="page-subtitle">
                Scroll to explore additional mentors that fit your subjects and
                topics.
              </p>
              <div className="matching-modal-grid">
                {filteredMenteeRecs.length === 0 && !menteeRecLoading && (
                  <p className="muted match-filter-empty">
                    No additional mentors to show right now.
                  </p>
                )}
                {filteredMenteeRecs.map((match, idx) => (
                  <MentorMatchCard
                    key={"modal-" + match.mentor_id + "-" + idx}
                    match={match}
                    myMentor={myMentor}
                    chosenMentorId={chosenMentorId}
                    unavailableMentorIds={unavailableMentorIds}
                    compact
                    menteeMatching={menteeMatching}
                    onRequestPairing={(mentorId) => {
                      handleChooseMentor(mentorId);
                      setShowMoreMentors(false);
                    }}
                    onViewProfile={openMentorProfileInNewTab}
                  />
                ))}
                {menteeRecLoading && (
                  <div className="matching-loading-inline">
                    <MatchingLoading />
                  </div>
                )}
              </div>
              <div className="btn-row matching-modal-footer">
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
            <div
              className="card mentee-info-modal mentor-info-modal modal-paper-container"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const match = selectedMentorDetails;
                const mentor = match.mentor || {};
                const d = match.match_details || {};
                const { percentage, label, tier } = formatMatchScore(
                  match.score,
                );
                const isOfficialPair =
                  (myMentor && isSameMentorMatch(match, myMentor)) ||
                  chosenMentorId === match.mentor_id;
                const isNotAvailable = unavailableMentorIds.includes(
                  match.mentor_id,
                );
                const mentorSubjects =
                  mentor.subjects && mentor.subjects.length
                    ? mentor.subjects
                    : d.mentor_subjects || [];
                const mentorTopics =
                  mentor.topics && mentor.topics.length
                    ? mentor.topics
                    : d.mentor_topics || [];
                return (
                  <>
                    <div className="match-card-header matching-modal-header">
                      <div className="match-card-main">
                        <div className="match-card-title-row">
                          <MatchPersonAvatar
                            name={
                              match.mentor_display_name ||
                              match.mentor_username
                            }
                            url={mentor.avatar_url}
                            className="match-column-avatar"
                          />
                          <div>
                            <h2 className="page-title matching-modal-title">
                              Mentor profile
                            </h2>
                            <p className="page-subtitle matching-modal-subtitle">
                              {match.mentor_display_name ||
                                match.mentor_username}
                            </p>
                            {mentor.role && (
                              <MentorRoleBadge
                                role={mentor.role}
                                prominent
                                className="mentor-role-badge--spaced"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      <span
                        className={
                          "match-card-score match-score-badge match-score-tier-" +
                          tier
                        }
                      >
                        {percentage}% · {label}
                      </span>
                    </div>
                    <p className="page-subtitle">
                      A quick snapshot of this mentor&apos;s profile,
                      availability, and capacity.
                    </p>
                    <div className="form-grid matching-modal-grid">
                      <div>
                        <p>
                          <strong>Biological sex:</strong>{" "}
                          {mentor.gender || "—"}
                        </p>
                        {mentor.expertise_level != null && (
                          <p>
                            <strong>Expertise level:</strong>{" "}
                            {mentor.expertise_level}/5
                          </p>
                        )}
                        {mentor.capacity != null && (
                          <p>
                            <strong>Capacity:</strong> {mentor.capacity} mentees
                          </p>
                        )}
                      </div>
                      <div>
                        {(mentor.availability || []).length > 0 && (
                          <p>
                            <strong>Availability:</strong>{" "}
                            {formatSlotList(mentor.availability)}
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
                            <strong>Topics:</strong> {mentorTopics.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="btn-row matching-modal-actions">
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
                          handleChooseMentor(match.mentor_id);
                          setSelectedMentorDetails(null);
                        }}
                        disabled={isOfficialPair || isNotAvailable}
                      >
                        {isOfficialPair
                          ? "Official Pair"
                          : isNotAvailable
                            ? "Not Available"
                            : "Choose this mentor"}
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
              {lastRunMode === "group" && lastRunMinScore != null && (
                <span className="matching-results-badge">
                  Group (min {formatMatchScore(lastRunMinScore).percentage}%)
                </span>
              )}
              {lastRunMode === "one_to_one" && (
                <span className="matching-results-badge">One to one</span>
              )}
            </div>
            {matchingResults.map((row, idx) => {
              const d = row.match_details || {};
              const mentor = row.mentor || {};
              const mentee = row.mentee || {};
              return (
                <div
                  key={row.mentor_id + "-" + row.mentee_id}
                  className="match-card"
                >
                  <div className="match-card-header">
                    <span className="match-card-pair">Pair {idx + 1}</span>
                    <span
                      className={
                        "match-card-score match-score-badge match-score-tier-" +
                        formatMatchScore(row.score).tier
                      }
                    >
                      {formatMatchScore(row.score).percentage}% ·{" "}
                      {formatMatchScore(row.score).label}
                    </span>
                  </div>
                  <div className="match-card-columns">
                    <div className="match-column">
                      <div className="match-column-header">
                        <MatchPersonAvatar
                          name={
                            row.mentor_display_name || row.mentor_username
                          }
                          url={mentor.avatar_url}
                          className="match-column-avatar"
                        />
                        <h4>
                          Mentor:{" "}
                          {row.mentor_display_name || row.mentor_username}
                        </h4>
                      </div>
                      {mentor.role && (
                        <p className="matching-role-wrap">
                          <MentorRoleBadge role={mentor.role} prominent />
                        </p>
                      )}
                      {(mentor.subjects || d.mentor_subjects || []).length >
                        0 && (
                        <p>
                          <strong>Subjects:</strong>{" "}
                          {mentor.subjects && mentor.subjects.length
                            ? mentor.subjects.join(", ")
                            : (d.mentor_subjects || []).join(", ") || "—"}
                        </p>
                      )}
                      {(mentor.topics || d.mentor_topics || []).length > 0 && (
                        <p>
                          <strong>Topics:</strong>{" "}
                          {mentor.topics && mentor.topics.length
                            ? mentor.topics.join(", ")
                            : (d.mentor_topics || []).join(", ") || "—"}
                        </p>
                      )}
                    </div>
                    <div className="match-column">
                      <div className="match-column-header">
                        <MatchPersonAvatar
                          name={
                            row.mentee_display_name || row.mentee_username
                          }
                          url={mentee.avatar_url}
                          className="match-column-avatar"
                        />
                        <h4>
                          Mentee:{" "}
                          {row.mentee_display_name || row.mentee_username}
                        </h4>
                      </div>
                      {(mentee.subjects || d.mentee_subjects || []).length >
                        0 && (
                        <p>
                          <strong>Subjects:</strong>{" "}
                          {mentee.subjects && mentee.subjects.length
                            ? mentee.subjects.join(", ")
                            : (d.mentee_subjects || []).join(", ") || "—"}
                        </p>
                      )}
                      {(mentee.topics || d.mentee_topics || []).length > 0 && (
                        <p>
                          <strong>Topics:</strong>{" "}
                          {mentee.topics && mentee.topics.length
                            ? mentee.topics.join(", ")
                            : (d.mentee_topics || []).join(", ") || "—"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="match-reason">
                    <strong>Why this match:</strong>
                    {(d.common_subjects || []).length > 0 ||
                    (d.common_competencies || d.common_topics || []).length > 0 ? (
                      <>
                        <span>
                          {" "}
                          Shared subjects:{" "}
                          {(d.common_subjects || []).join(", ")}.{" "}
                        </span>
                        <span>
                          Shared competencies:{" "}
                          {(d.common_competencies || d.common_topics || []).join(", ")}.
                        </span>
                      </>
                    ) : (
                      <span className="muted">
                        {" "}
                        {formatMatchScore(row.score).label}.
                      </span>
                    )}
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
