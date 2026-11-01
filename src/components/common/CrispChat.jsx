import { useEffect, useRef } from "react";
import { Crisp } from "crisp-sdk-web";
import { useAuth } from "../../store/AuthContext.jsx";
import { useCrispToken } from "../../hooks/useCrispToken";
import { toPascalCaseName } from "../../utils/format";

// Support chat — configured once, then reconciled with the auth state.
//
// Session-binding rules (Crisp's own docs, incl. the known session-leak
// issue): the token is ALWAYS set/cleared before a session reset, and
// identity (email etc.) is (re)pushed AFTER every reset — a reset wipes
// session data, so pushing before it would silently lose the identity.
//
// The Crisp dashboard carries a Glass logo as the website avatar. Crisp
// re-injects it into the widget on every repaint (chat open/close toggles
// the launcher), so CSS alone always reverts — the observer below strips
// the avatar from the DOM wherever it appears, making the custom launcher
// glyph the only icon that ever renders. Scoped to #crisp-chatbox: the
// logo must go from the widget entirely, nothing outside it is touched.
const WEBSITE_AVATAR_MARK = "/avatar/website/";

function isWebsiteAvatarUrl(url) {
  return typeof url === "string" && url.includes(WEBSITE_AVATAR_MARK);
}

function stripWebsiteAvatar(node) {
  if (!(node instanceof Element)) return;
  const box = node.closest("#crisp-chatbox") ?? node.querySelector("#crisp-chatbox");
  if (!box) return; // mutation outside the widget
  for (const el of box.querySelectorAll("*")) {
    if (isWebsiteAvatarUrl(el.style.backgroundImage)) {
      el.style.removeProperty("background-image");
    }
    if (el.tagName === "IMG" && isWebsiteAvatarUrl(el.getAttribute("src"))) {
      el.removeAttribute("src");
      el.style.setProperty("display", "none", "important");
    }
    // Chat-window avatars are inline SVGs: the Glass logo sits in an
    // <image> layer above the default Crisp avatar. Drop the href so the
    // default shows through — the logo must never render anywhere.
    if (
      el.tagName === "image" &&
      (isWebsiteAvatarUrl(el.getAttribute("xlink:href")) ||
        isWebsiteAvatarUrl(el.getAttribute("href")))
    ) {
      el.removeAttribute("xlink:href");
      el.removeAttribute("href");
    }
  }
}

export default function CrispChat() {
  const { user, loading } = useAuth();
  const configured = useRef(false);
  // What the Crisp session is currently bound to — used to detect login,
  // logout and account switches (the switch case MUST unbind the previous
  // account first or its conversation shows up under the next one).
  const bound = useRef({ user: null, token: null });
  const websiteId = import.meta.env.VITE_CRISP_WEBSITE_ID;

  const { data: tokenId } = useCrispToken();

  useEffect(() => {
    if (!websiteId || configured.current) return;
    // sessionMerge: a conversation started before signing in is merged into
    // the token session on first bind, so "I already asked about this"
    // survives the login step.
    Crisp.configure(websiteId, { sessionMerge: true });
    configured.current = true;
  }, [websiteId]);

  useEffect(() => {
    if (!websiteId) return;
    // Permanently remove the Glass logo from the widget: watch the whole
    // document (Crisp injects #crisp-chatbox asynchronously) but only act
    // on mutations inside it. Re-stripping a stripped node is a no-op, so
    // Crisp re-applying the avatar cannot loop the observer.
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          stripWebsiteAvatar(mutation.target);
        } else {
          for (const node of mutation.addedNodes) stripWebsiteAvatar(node);
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style", "src", "href", "xlink:href"],
    });
    return () => observer.disconnect();
  }, [websiteId]);

  useEffect(() => {
    if (!websiteId || !configured.current || loading) return;

    const userId = user?.id ?? null;

    if (userId !== bound.current.user) {
      // Login / logout / account switch: unbind whatever was connected.
      if (bound.current.user !== null || bound.current.token !== null) {
        Crisp.setTokenId(); // no arg = clear the token
        Crisp.session.reset();
      }
      bound.current = { user: userId, token: null };
      if (!userId) return; // logged out — unbound, nothing else to do
    } else if (!userId) {
      return; // anonymous visitor, nothing changed
    }

    // Bind the token once it has resolved for this user. While it's still
    // loading we identify immediately (agents see the user right away) and
    // the reset below simply runs again when the token arrives.
    if (tokenId === undefined) {
      // token query still in flight — fall through to identity push
    } else if (tokenId && tokenId !== bound.current.token) {
      Crisp.setTokenId(tokenId);
      Crisp.session.reset();
      bound.current.token = tokenId;
    } else if (!tokenId && bound.current.token) {
      Crisp.setTokenId();
      Crisp.session.reset();
      bound.current.token = null;
    }

    // Data minimization: email + internal id + role only. Phone and any
    // financial data stay out of the third-party chat log (NDPR) — the id
    // is enough for an agent to look the account up.
    Crisp.user.setEmail(user.email);
    const name = toPascalCaseName([user.firstName, user.lastName].filter(Boolean).join(" "));
    if (name) Crisp.user.setNickname(name);
    const sessionData = { user_id: userId };
    if (user.role) sessionData.role = user.role;
    Crisp.session.setData(sessionData);
  }, [loading, user, tokenId, websiteId]);

  return null;
}
