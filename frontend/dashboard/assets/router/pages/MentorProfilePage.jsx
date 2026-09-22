(function () {
  "use strict";
  const React = window.React;
  const { useContext } = React;
  const AppContext = window.DashboardApp.AppContext;
  const MentorProfileCard = window.DashboardApp.MentorProfileCard;

  function MentorProfilePage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const {
      user,
      viewedMentorProfile,
      setViewedMentorProfile,
      setActiveTab,
      chooseMentor,
      chosenMentorId,
      pendingMentorIds = [],
      myMentor,
      menteeMatching,
    } = ctx;

    if (!viewedMentorProfile) {
      return (
        <div className="card">
          <h1 className="page-title">Mentor profile</h1>
          <p className="page-subtitle">
            No mentor selected. Go back to Matching to choose a mentor and view their profile.
          </p>
          <div className="btn-row" style={{ marginTop: "12px" }}>
            <button type="button" className="btn secondary" onClick={() => setActiveTab("matching")}>
              Back to Matching
            </button>
          </div>
        </div>
      );
    }

    const match = viewedMentorProfile;
    const mentor = match.mentor || {};
    const isOfficial =
      (myMentor &&
        ((myMentor.id != null && Number(myMentor.id) === Number(match.mentor_id)) ||
          (myMentor.user_id != null &&
            mentor.user_id != null &&
            Number(myMentor.user_id) === Number(mentor.user_id)))) ||
      chosenMentorId === match.mentor_id;

    return (
      <div className="prof-page matching-page matching-page--mentee">
        <div className="page-shell-head">
          <div>
            <h1 className="page-title">Mentor profile</h1>
            <p className="page-subtitle">
              Compatibility, availability, and how this mentor can support you.
            </p>
          </div>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => {
              setViewedMentorProfile(null);
              setActiveTab("matching");
            }}
          >
            Back to Matching
          </button>
        </div>
        {MentorProfileCard ? (
          <MentorProfileCard
            person={mentor}
            displayName={match.mentor_display_name || match.mentor_username}
            email={mentor.email}
            score={match.score}
            matchDetails={match.match_details}
            variant="detail"
            kind="mentor"
            isOfficial={!!isOfficial}
            isPending={pendingMentorIds.includes(match.mentor_id) || !!match.is_pending}
            menteeMatching={menteeMatching}
            slotsLeft={match.slots_left}
            savedId={mentor.user_id || match.mentor_id}
            onRequestPairing={
              user.role === "mentee" && typeof chooseMentor === "function" && match.mentor_id
                ? () => chooseMentor(match.mentor_id)
                : undefined
            }
          />
        ) : null}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["mentor-profile"] = MentorProfilePage;
})();
