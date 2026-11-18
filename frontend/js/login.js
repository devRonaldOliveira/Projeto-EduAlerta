// Interface inicial: nenhuma credencial é transmitida ou armazenada.
// A autenticação deverá ser implementada somente após confirmar o contrato
// da API FastAPI com a equipe (endpoint, campos, sessão e erros).
const loginForm = document.querySelector('#login-form');
const formMessage = document.querySelector('#form-message');

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  formMessage.textContent = '';

  const email = loginForm.elements.email;
  const password = loginForm.elements.password;

  if (!email.value.trim() || !email.validity.valid) {
    formMessage.textContent = 'Informe um e-mail válido.';
    email.focus();
    return;
  }

  if (!password.value) {
    formMessage.textContent = 'Informe sua senha.';
    password.focus();
    return;
  }

  formMessage.textContent = 'O formulário está pronto. O acesso será habilitado quando o backend estiver conectado.';
});
