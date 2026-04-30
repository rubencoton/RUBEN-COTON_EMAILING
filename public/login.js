(() => {
  const form = document.getElementById("loginForm");
  const errorMessage = document.getElementById("errorMessage");
  const passwordInput = document.getElementById("password");
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");

  if (!form || !errorMessage || !passwordInput || !togglePasswordBtn) {
    return;
  }

  const setPasswordToggleState = (isVisible) => {
    passwordInput.type = isVisible ? "text" : "password";
    togglePasswordBtn.setAttribute(
      "aria-label",
      isVisible ? "Ocultar contraseña" : "Mostrar contraseña"
    );
    togglePasswordBtn.setAttribute(
      "title",
      isVisible ? "Ocultar contraseña" : "Mostrar contraseña"
    );
    togglePasswordBtn.textContent = isVisible ? "🙈" : "👁";
  };

  setPasswordToggleState(false);

  togglePasswordBtn.addEventListener("click", () => {
    const currentlyVisible = passwordInput.type === "text";
    setPasswordToggleState(!currentlyVisible);
    passwordInput.focus();
  });

  const url = new URL(window.location.href);
  const passwordFromQuery = url.searchParams.get("password");
  if (passwordFromQuery) {
    passwordInput.value = passwordFromQuery;
    history.replaceState({}, "", "/login");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorMessage.hidden = true;

    const formData = new FormData(form);
    const password = String(formData.get("password") || "");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        errorMessage.hidden = false;
        return;
      }

      window.location.href = "/";
    } catch (_error) {
      errorMessage.hidden = false;
    }
  });
})();
