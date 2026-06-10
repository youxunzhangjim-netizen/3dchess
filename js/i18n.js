export const I18N = {
    current: 'en',
    t: {
        title: {
            en: '8x8x8 3D Chess'
        }
    }
};

export function applyLanguage() {
    const title = document.getElementById('titleText');
    if (title) title.textContent = I18N.t.title.en;
}
