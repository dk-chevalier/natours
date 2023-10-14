(() => {
  // public/js/mapbox.js
  var displayMap = (locations) => {
    mapboxgl.accessToken = "pk.eyJ1IjoiZGstY2hldmFsaWVyIiwiYSI6ImNsbWEzOGp0aTBnbGkzZG1iODM1d2s3NXQifQ.V9FthG8gHIqpquI4a6G4yw";
    const map = new mapboxgl.Map({
      container: "map",
      // container ID
      style: "mapbox://styles/dk-chevalier/clma4g4xe012a01qz2p3pcolh",
      // style URL
      scrollZoom: false
      // so mouse doesn't change zoom level
      // center: [-118, 34], // starting position [lng, lat]
      // zoom: 9, // starting zoom
      // interactive: false,
    });
    const bounds = new mapboxgl.LngLatBounds();
    locations.forEach((loc) => {
      const el = document.createElement("div");
      el.className = "marker";
      new mapboxgl.Marker({
        element: el,
        anchor: "bottom"
      }).setLngLat(loc.coordinates).addTo(map);
      new mapboxgl.Popup({
        offset: 30
      }).setLngLat(loc.coordinates).setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`).addTo(map);
      bounds.extend(loc.coordinates);
    });
    map.fitBounds(bounds, {
      padding: {
        top: 200,
        // 200px
        bottom: 150,
        left: 100,
        right: 100
      }
    });
  };

  // public/js/alerts.js
  var hideAlert = () => {
    const el = document.querySelector(".alert");
    if (el)
      el.parentElement.removeChild(el);
  };
  var showAlert = (type, msg) => {
    hideAlert();
    const markup = `<div class="alert alert--${type}">${msg}</div>`;
    document.querySelector("body").insertAdjacentHTML("afterbegin", markup);
    window.setTimeout(hideAlert, 5e3);
  };

  // public/js/login.js
  var login = async (email, password) => {
    try {
      const res = await axios({
        method: "POST",
        url: "http://127.0.0.1:3000/api/v1/users/login",
        data: {
          email,
          password
        }
      });
      if (res.data.status === "success") {
        showAlert("success", "Logged in successfully!");
        window.setTimeout(() => {
          location.assign("/");
        }, 1500);
      }
    } catch (err) {
      showAlert("error", err.response.data.message);
    }
  };
  var logout = async () => {
    try {
      const res = await axios({
        method: "GET",
        url: "http://127.0.0.1:3000/api/v1/users/logout"
      });
      if (res.data.status === "success")
        location.reload(true);
    } catch (err) {
      console.log(err.response);
      showAlert("error", "Error logging out! Try again.");
    }
  };

  // public/js/updateSettings.js
  var updateSettings = async (data, type) => {
    try {
      const url = type === "password" ? "http://127.0.0.1:3000/api/v1/users/updateMyPassword" : "http://127.0.0.1:3000/api/v1/users/updateMe";
      const res = await axios({
        method: "PATCH",
        url,
        data
      });
      if (res.data.status === "success") {
        showAlert("success", `${type.toUpperCase()} updated successfully!`);
      }
    } catch (err) {
      showAlert("error", err.response.data.message);
    }
  };

  // public/js/stripe.js
  var stripe = Stripe(
    "pk_test_51O0ErwLaaxuYLkeOYCYW1Ad7tcmEfOJwLmt3JpQOUPGn5bbw4q9nblbZ0XhD6a0crrsV8361XTq4qlJ2GOlNiVQi00YSKm0Kru"
  );
  var bookTour = async (tourId) => {
    try {
      const session = await axios(
        `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`
      );
      console.log(session.data.session.id);
      await stripe.redirectToCheckout({
        sessionId: session.data.session.id
      });
    } catch (err) {
      console.log(err);
      showAlert("error", err);
    }
  };

  // public/js/index.js
  var mapBox = document.getElementById("map");
  var loginForm = document.querySelector(".form--login");
  var logoutBtn = document.querySelector(".nav__el--logout");
  var userDataForm = document.querySelector(".form-user-data");
  var userPasswordForm = document.querySelector(".form-user-password");
  var bookBtn = document.getElementById("book-tour");
  if (mapBox) {
    const locations = JSON.parse(mapBox.dataset.locations);
    displayMap(locations);
  }
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      login(email, password);
    });
  }
  if (logoutBtn)
    logoutBtn.addEventListener("click", logout);
  if (userDataForm) {
    userDataForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = new FormData();
      form.append("name", document.getElementById("name").value);
      form.append("email", document.getElementById("email").value);
      form.append("photo", document.getElementById("photo").files[0]);
      console.log(form);
      updateSettings(form, "data");
    });
  }
  if (userPasswordForm) {
    userPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      document.querySelector(".btn--save-password").textContent = "Updating...";
      const passwordCurrent = document.getElementById("password-current").value;
      const password = document.getElementById("password").value;
      const passwordConfirm = document.getElementById("password-confirm").value;
      await updateSettings(
        { passwordCurrent, password, passwordConfirm },
        "password"
      );
      document.querySelector(".btn--save-password").textContent = "Save password";
      document.getElementById("password-current").value = "";
      document.getElementById("password").value = "";
      document.getElementById("password-confirm").value = "";
    });
  }
  if (bookBtn) {
    bookBtn.addEventListener("click", (e) => {
      e.target.textContent = "Processing...";
      const { tourId } = e.target.dataset;
      bookTour(tourId);
    });
  }
})();
