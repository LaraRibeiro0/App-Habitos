// =====================================================================
//  Ecrã de entrada: "Entrar com Google" ou com email e palavra-passe.
// =====================================================================
import { APP_NOME } from '../config.js';
import * as db from '../data.js';
import { $, esc, aviso, mostrarErro } from '../util.js';

const ICONE_GOOGLE = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

export async function mostrar(ecra) {
  let modo = 'entrar'; // ou 'criar'

  function desenhar() {
    ecra.innerHTML = `
      <section class="entrada ecra" style="padding:0">
        <div class="entrada-marca">
          <div class="anel" aria-hidden="true"></div>
          <h1>${esc(APP_NOME)}</h1>
          <p class="suave">Regista a alimentação, o exercício, o sono e os teus hábitos, e vê a tua evolução ao longo do tempo.</p>
        </div>

        <div class="cartao">
          <button class="botao botao-grande botao-google" id="google">${ICONE_GOOGLE} Entrar com Google</button>
          ${navigator.standalone ? `<p class="suave pequeno">No iPhone, a app instalada no ecrã principal não consegue
            receber o login da Google. Entra aqui com email e palavra-passe (podes defini-la nas Definições, no Safari).</p>` : ''}
          <div class="separador">ou com email</div>
          <form id="form-email" class="cartao" style="padding:0;border:none;box-shadow:none">
            <label class="campo"><span>Email</span>
              <input type="email" id="email" autocomplete="email" required></label>
            <label class="campo"><span>Palavra-passe</span>
              <input type="password" id="password" minlength="6" required
                autocomplete="${modo === 'entrar' ? 'current-password' : 'new-password'}"></label>
            <button class="botao botao-grande" type="submit">${modo === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
          </form>
          <p class="suave pequeno" style="text-align:center">
            ${modo === 'entrar'
              ? 'Ainda não tens conta? <button class="botao botao-texto" id="trocar">Criar conta</button>'
              : 'Já tens conta? <button class="botao botao-texto" id="trocar">Entrar</button>'}
          </p>
        </div>
        <p class="suave pequeno" style="text-align:center"><a href="privacidade.html">Política de privacidade</a></p>
      </section>`;

    $('#google', ecra).addEventListener('click', async () => {
      const { error } = await db.entrarComGoogle();
      if (error) mostrarErro(error, 'Não foi possível entrar com Google');
      // Se correr bem, o browser é levado para a página da Google.
    });

    $('#trocar', ecra).addEventListener('click', () => {
      modo = modo === 'entrar' ? 'criar' : 'entrar';
      desenhar();
    });

    $('#form-email', ecra).addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#email', ecra).value.trim();
      const password = $('#password', ecra).value;
      const botao = e.submitter;
      botao.disabled = true;

      if (modo === 'entrar') {
        const { error } = await db.entrarComEmail(email, password);
        if (error) {
          botao.disabled = false;
          return aviso(error.message.includes('Invalid login')
            ? 'Email ou palavra-passe errados.'
            : error.message.includes('not confirmed')
              ? 'Confirma primeiro o teu email (vê a caixa de entrada).'
              : error.message, 'erro');
        }
        // A app muda de ecrã sozinha quando a sessão é criada.
      } else {
        const { data, error } = await db.criarConta(email, password);
        botao.disabled = false;
        if (error) return mostrarErro(error, 'Não foi possível criar a conta');
        if (!data.session) {
          aviso('Conta criada! Enviámos-te um email para confirmares.');
          modo = 'entrar';
          desenhar();
        }
      }
    });
  }

  desenhar();
}
