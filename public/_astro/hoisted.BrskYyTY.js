import"./hoisted.B1Rv-jdT.js";
const urlParams = new URLSearchParams(window.location.search);
const intentionParam = urlParams.get("intention");
const selectEl = document.getElementById("intention");
if (intentionParam && selectEl) {
  selectEl.value = intentionParam;
}

const form = document.getElementById("contact-form");
const statusEl = document.getElementById("contact-status");
const submitBtn = document.getElementById("contact-submit");

function showStatus(message, isError) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.remove("hidden", "text-grenade", "text-mist");
  statusEl.classList.add(isError ? "text-grenade" : "text-mist");
}

async function getCsrfToken() {
  const res = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
  if (!res.ok) throw new Error("csrf");
  const data = await res.json();
  return data.csrfToken;
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    if (submitBtn) submitBtn.disabled = true;
    showStatus("Envoi en cours…", false);

    const payload = {
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      intention: selectEl ? selectEl.value : "",
      message: document.getElementById("message").value,
      website: document.getElementById("website").value,
    };

    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/contact", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 201) {
        form.reset();
        showStatus("Message envoyé, merci ! Nous revenons vers vous rapidement.", false);
      } else if (res.status === 429) {
        showStatus("Trop de messages envoyés. Réessayez dans quelques minutes.", true);
      } else {
        const data = await res.json().catch(() => ({}));
        showStatus(data.error || "Une erreur est survenue, réessayez plus tard.", true);
      }
    } catch (err) {
      showStatus("Une erreur est survenue, réessayez plus tard.", true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
