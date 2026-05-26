/* ============================================
   Global Scroll-to-Top Button
   Shows when scrolled > 1 viewport (window.innerHeight)
   Works on both index.html and match.html
   ============================================ */
(function () {
  if (typeof window === "undefined") return;

  // Inject button + styles once
  function init() {
    if (document.getElementById("scroll-top-btn")) return;

    const style = document.createElement("style");
    style.textContent = `
      #scroll-top-btn {
        position: fixed;
        right: 20px;
        bottom: 24px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #ec4899);
        color: white;
        border: none;
        cursor: pointer;
        font-size: 20px;
        font-weight: 700;
        line-height: 1;
        z-index: 999;
        box-shadow: 0 8px 24px rgba(99, 102, 241, 0.45);
        opacity: 0;
        visibility: hidden;
        transform: translateY(16px);
        transition: opacity 0.25s ease, visibility 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #scroll-top-btn.visible {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
      #scroll-top-btn:hover {
        box-shadow: 0 12px 32px rgba(99, 102, 241, 0.7);
        transform: translateY(-2px);
      }
      html[dir="rtl"] #scroll-top-btn {
        right: auto;
        left: 20px;
      }
      @media (max-width: 600px) {
        #scroll-top-btn { width: 44px; height: 44px; right: 16px; bottom: 18px; }
      }
    `;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.id = "scroll-top-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Back to top");
    btn.innerHTML = "↑";
    document.body.appendChild(btn);

    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const threshold = window.innerHeight; // > 1 viewport
        if (window.scrollY > threshold) {
          btn.classList.add("visible");
        } else {
          btn.classList.remove("visible");
        }
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
