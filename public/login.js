let isSubmitting = false;

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    isSubmitting = true;

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');

    const btnLogin = document.getElementById('btn-login');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');

    btnLogin.disabled = true;
    btnText.classList.add('d-none');
    btnSpinner.classList.remove('d-none');
    messageDiv.textContent = '';
    messageDiv.classList.remove('text-danger', 'text-success');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            messageDiv.classList.add('text-success');
            messageDiv.textContent = data.message || 'Logare reușită!';

            setTimeout(() => {
                window.location.href = data.redirectUrl || '/';
            }, 1000);
        } else {
            isSubmitting = false;
            btnLogin.disabled = false;
            btnText.classList.remove('d-none');
            btnSpinner.classList.add('d-none');

            messageDiv.classList.add('text-danger');
            messageDiv.textContent = data.message || 'Eroare la logare.';
        }
    } catch (error) {
        isSubmitting = false;
        btnLogin.disabled = false;
        btnText.classList.remove('d-none');
        btnSpinner.classList.add('d-none');

        messageDiv.classList.add('text-danger');
        messageDiv.textContent = 'Eroare de conexiune cu serverul.';
    }
});