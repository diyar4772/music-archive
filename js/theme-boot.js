// Paint the stored theme onto <html> before the first frame.
//
// The theme lives in two places: `data-ma-theme` drives the design-system
// tokens in styles.css, and the `dark` class drives Tailwind's `dark:`
// utilities in the older modal markup. app.js keeps both in sync afterwards;
// this only stops the dark default from flashing on a light-mode reload.
(function () {
    let theme;
    try {
        theme = localStorage.getItem('theme');
    } catch {
        theme = null;
    }
    const isDark = theme !== 'light';
    document.documentElement.dataset.maTheme = isDark ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', isDark);
})();
