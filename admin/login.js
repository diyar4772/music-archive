'use strict';

const form = document.getElementById('adminLoginForm');
const button = document.getElementById('loginButton');
const error = document.getElementById('loginError');

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    error.classList.add('hidden');

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: form.elements.username.value,
                password: form.elements.password.value
            })
        });
        if (!response.ok) {
            error.textContent = response.status === 429
                ? 'Fazla sayıda deneme yapıldı. Lütfen daha sonra yeniden deneyin.'
                : 'Kullanıcı adı veya şifre geçersiz.';
            error.classList.remove('hidden');
            return;
        }
        window.location.replace('/admin');
    } catch (_requestError) {
        error.textContent = 'Sunucuya bağlanılamıyor.';
        error.classList.remove('hidden');
    } finally {
        button.disabled = false;
    }
});
