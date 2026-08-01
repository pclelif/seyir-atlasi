const GA_MEASUREMENT_ID = "G-B6TZNKWKVD";

window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
};

window.gtag("js", new Date());
window.gtag("config", GA_MEASUREMENT_ID);

const googleTag = document.createElement("script");
googleTag.async = true;
googleTag.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
document.head.append(googleTag);
