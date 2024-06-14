const getKey = () => {
    return 'L3B16-Q1HWH-KKFRH-9MJ38-RXWYM';
}
new fullpage("#fullpage", {
    licenseKey: 'L3B16-Q1HWH-KKFRH-9MJ38-RXWYM',
    anchors: ["section1", "section2", "section3", "section4"],
    // sectionsColor: ["#f9f9f9"],
    sectionsColor: ["#f9f9f9", "#E6F3F4", "#f9f9f9", "#f9f9f9"],
    fixedElements: "#header",
    paddingTop: "4.375rem",
    scrollOverflow: true,
    scrollingSpeed: 1000,
    navigation: true,
    showActiveTooltip: true,
    credits: {
        enabled: false,
    },
});