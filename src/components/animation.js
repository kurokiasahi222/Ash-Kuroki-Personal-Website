document.addEventListener("DOMContentLoaded", () => {
  const hiddenElems = document.querySelectorAll(".animation");
  const options = {
    threshold: 0.4,
  };
  const observerCallback = (entries) => {
    entries.forEach((entry) => {
      console.log(entry);
      if (entry.isIntersecting) {
        entry.target.classList.add("intersect");
      } else {
        entry.target.classList.remove("intersect");
      }
    });
  };
  const observer = new IntersectionObserver(observerCallback, options);
  hiddenElems.forEach((el) => observer.observe(el));
});
