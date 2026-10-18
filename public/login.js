let isSubmitting = false; 

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return; 

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');
    
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    
    btnText.classList.add('d-none');
    btnSpinner.classList.remove('d-none');
    messageDiv.textContent = ''; 

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
            isSubmitting = false;
            btnText.classList.remove('d-none');
            btnSpinner.classList.add('d-none');
            
            messageDiv.style.color = 'red';
            messageDiv.textContent = data.message || 'Eroare la logare.';
        }
    } catch (error) {
        isSubmitting = false;
        btnText.classList.remove('d-none');
        btnSpinner.classList.add('d-none');
        
        messageDiv.style.color = 'red';
        messageDiv.textContent = 'Eroare de conexiune cu serverul.';
    }
});