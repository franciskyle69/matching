(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useState } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { getCookie, fetchJSON, LoadingSpinner } = Utils;
  const Spinner = LoadingSpinner;

  function NewsfeedPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;

    const PostUI = window.DashboardApp.PostUI || {};
    const {
      PostComposerTrigger,
      PostComposer,
      PostCard,
      PostModal,
      ImageModal,
    } = PostUI;

    const {
      user,
      postsFeed,
      postsFeedLoaded,
      postsFeedLoading,
      postsFeedHasMore,
      postsFeedLoadingMore,
      loadPostsFeed,
      setPostsFeed,
      loadUserProfile,
    } = ctx;

    const [showComposerModal, setShowComposerModal] = useState(false);
    const [posting, setPosting] = useState(false);
    const [openPost, setOpenPost] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [commentsCache, setCommentsCache] = useState({});

    const avatarUrl = user.avatar_url || "";
    const displayName =
      user.display_name || user.full_name || user.username || "there";

    useEffect(() => {
      if (!postsFeedLoaded) loadPostsFeed(0);
    }, [postsFeedLoaded]);

    useEffect(() => {
      if (!showComposerModal) return undefined;
      function onKey(e) {
        if (e.key === "Escape") setShowComposerModal(false);
      }
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }, [showComposerModal]);

    async function handlePost({ text, category, imageFile }) {
      setPosting(true);
      try {
        const fd = new FormData();
        fd.append("text", text);
        fd.append("category", category);
        if (imageFile) fd.append("image", imageFile);
        const res = await fetchJSON("/api/posts/create/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: fd,
          raw: true,
        });
        if (res.ok && res.data.post) {
          setPostsFeed((prev) => [res.data.post, ...(prev || [])]);
          return true;
        }
        return false;
      } finally {
        setPosting(false);
      }
    }

    async function handleLike(postId) {
      const res = await fetchJSON(`/api/posts/${postId}/like/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      });
      if (res.ok) {
        const update = {
          liked_by_me: res.data.liked,
          likes_count: res.data.likes_count,
        };
        setPostsFeed((prev) =>
          (prev || []).map((p) => (p.id === postId ? { ...p, ...update } : p)),
        );
        setOpenPost((prev) =>
          prev && prev.id === postId ? { ...prev, ...update } : prev,
        );
      }
    }

    function handlePostUpdate(postId, fields) {
      setPostsFeed((prev) =>
        (prev || []).map((p) => (p.id === postId ? { ...p, ...fields } : p)),
      );
      setOpenPost((prev) =>
        prev && prev.id === postId ? { ...prev, ...fields } : prev,
      );
    }

    async function handleDelete(postId) {
      const res = await fetchJSON(`/api/posts/${postId}/delete/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      });
      if (res.ok) {
        setPostsFeed((prev) => (prev || []).filter((p) => p.id !== postId));
        if (openPost && openPost.id === postId) setOpenPost(null);
      }
    }

    async function handleShare(postId) {
      const res = await fetchJSON(`/api/posts/${postId}/share/`, {
        method: "POST",
        headers: {
          "X-CSRFToken": getCookie("csrftoken"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) return false;
      if (res.data?.post && !res.data.already_shared) {
        setPostsFeed((prev) => [res.data.post, ...(prev || [])]);
      }
      if (typeof window.DashboardApp?.notify === "function") {
        window.DashboardApp.notify(
          res.data?.already_shared
            ? "Already on your profile."
            : "Shared to your profile.",
          "success",
        );
      }
      return true;
    }

    function openAuthorProfile(post) {
      if (!post || !post.author_id) return;
      if (post.author_id === user.id) {
        if (typeof ctx.setActiveTab === "function") ctx.setActiveTab("profile");
        return;
      }
      if (typeof loadUserProfile === "function") loadUserProfile(post.author_id);
    }

    if (!PostCard || !PostComposer) {
      return (
        <div className="card newsfeed-page page-shell">
          <p className="muted">Loading newsfeed…</p>
        </div>
      );
    }

    const posts = Array.isArray(postsFeed) ? postsFeed : [];
    const loading = postsFeedLoading && !postsFeedLoaded;

    return (
      <div className="newsfeed-page page-shell">
        <header className="newsfeed-header">
          <h1 className="page-title">Newsfeed</h1>
          <p className="page-subtitle">
            See what mentors and mentees are sharing across PeerLink.
          </p>
        </header>

        <div className="newsfeed-column">
          <section className="newsfeed-composer-card">
            <PostComposerTrigger
              avatarUrl={avatarUrl}
              username={displayName}
              onClick={() => setShowComposerModal(true)}
            />
          </section>

          {(loading || posting) && (
            <Spinner
              title={posting ? "Posting…" : "Loading newsfeed…"}
              subtitle={
                posting
                  ? "Publishing your update"
                  : "Fetching the latest posts"
              }
            />
          )}

          {!loading && posts.length === 0 && (
            <div className="newsfeed-empty fancy-empty">
              <p className="muted">
                No posts yet. Be the first to share an update, achievement, or
                project.
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => setShowComposerModal(true)}
              >
                Create a post
              </button>
            </div>
          )}

          <div className="newsfeed-list">
            {!loading &&
              posts.map((post) => (
                <div key={post.id} className="newsfeed-post-wrap">
                  <PostCard
                    post={post}
                    onLike={handleLike}
                    onDelete={handleDelete}
                    onShare={handleShare}
                    isOwner={post.author_id === user.id}
                    onOpen={setOpenPost}
                  />
                  {post.author_id && post.author_id !== user.id && (
                    <button
                      type="button"
                      className="newsfeed-author-link"
                      onClick={() => openAuthorProfile(post)}
                    >
                      View {post.author_display_name || post.author_username}&apos;s
                      profile
                    </button>
                  )}
                </div>
              ))}
          </div>

          {!loading && postsFeedHasMore && (
            <div className="sp-load-more-wrap newsfeed-load-more">
              <button
                type="button"
                className="sp-load-more-btn"
                onClick={() => loadPostsFeed(posts.length)}
                disabled={postsFeedLoadingMore}
              >
                {postsFeedLoadingMore ? <Spinner inline /> : "See more posts"}
              </button>
            </div>
          )}
        </div>

        {showComposerModal && (
          <div
            className="sp-composer-modal-backdrop"
            onClick={() => setShowComposerModal(false)}
          >
            <div
              className="sp-composer-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sp-composer-modal-header">
                <h3 className="sp-composer-modal-title">Create post</h3>
                <button
                  type="button"
                  className="sp-composer-modal-close"
                  onClick={() => setShowComposerModal(false)}
                  aria-label="Close"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="sp-composer-modal-body">
                <PostComposer
                  onPost={(payload) => {
                    setShowComposerModal(false);
                    handlePost(payload);
                  }}
                  posting={false}
                />
              </div>
            </div>
          </div>
        )}

        {lightboxImage && ImageModal && (
          <ImageModal
            image={lightboxImage}
            onClose={() => setLightboxImage(null)}
          />
        )}
        {openPost && PostModal && (
          <PostModal
            post={openPost}
            onClose={() => setOpenPost(null)}
            onLike={handleLike}
            onPostUpdate={handlePostUpdate}
            currentUserId={user.id}
            commentsCache={commentsCache}
            setCommentsCache={setCommentsCache}
          />
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.newsfeed = NewsfeedPage;
})();
