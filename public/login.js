document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');

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

            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        } else {
            messageDiv.style.color = 'red';
            messageDiv.textContent = data.message || 'Eroare la logare.';
        }
    } catch (error) {
        messageDiv.style.color = 'red';
        messageDiv.textContent = 'Eroare de conexiune cu serverul.';
    }
});