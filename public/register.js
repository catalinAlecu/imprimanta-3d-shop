document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const repeatPassword = document.getElementById('repeatPassword').value;
    const messageDiv = document.getElementById('message');

    const turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value;

    if (!turnstileToken) {
        messageDiv.style.color = 'red';
        messageDiv.textContent = 'Te rugam sa bifezi verificarea de securitate!';
        return;
    }

    if (password !== repeatPassword) {
        messageDiv.style.color = 'red';
        messageDiv.textContent = 'Parolele nu se potrivesc!';
        return; 
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password, turnstileToken }) 
        });

        const data = await response.json();

        if (response.ok) {
            messageDiv.style.color = '#252525'; 
            messageDiv.textContent = 'Cont creat cu succes! Vei fi redirectionat...';
            
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            messageDiv.style.color = 'red';
            messageDiv.textContent = data.message || 'Eroare la inregistrare.';
            if (window.turnstile) window.turnstile.reset();
        }
        
    } catch (error) {
        messageDiv.style.color = 'red';
        messageDiv.textContent = 'Eroare de conexiune cu serverul.';
        if (window.turnstile) window.turnstile.reset();
    }
});