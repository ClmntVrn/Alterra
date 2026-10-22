import { initializeCalendar } from "./calendar.js";

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.error("Service worker:", error));
  });
}

initializeCalendar();
