document.addEventListener('DOMContentLoaded', () => {

    const hiddenElems = document.querySelectorAll(".animation");
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            console.log(entry);
            if (entry.isIntersecting) {
                entry.target.classList.add("intersect");
            }
            else {
            entry.target.classList.remove("intersect");
            }
        });
    });
    hiddenElems.forEach((el) => observer.observe(el));
})