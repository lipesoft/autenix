import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Radio,
  ShieldCheck,
  X,
} from "lucide-react";
import { loginUsuario, rotaDoPerfil } from "../../services/auth.js";

export default function LoginModal({ aberto, onClose, onLogin, restauranteSlug }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [slug, setSlug] = useState(restauranteSlug || "autenix");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [status, setStatus] = useState("idle");
  const [mensagem, setMensagem] = useState("");
  const loginRef = useRef(null);

  const fechar = useCallback(() => {
    setLogin("");
    setSenha("");
    setSlug(restauranteSlug || "autenix");
    setMostrarSenha(false);
    setStatus("idle");
    setMensagem("");
    onClose();
  }, [onClose, restauranteSlug]);

  useEffect(() => {
    if (!aberto) return undefined;

    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => loginRef.current?.focus(), 80);

    const fecharComEsc = (event) => {
      if (event.key === "Escape" && status !== "success") fechar();
    };
    window.addEventListener("keydown", fecharComEsc);

    return () => {
      document.body.style.overflow = bodyOverflow;
      window.removeEventListener("keydown", fecharComEsc);
    };
  }, [aberto, fechar, status]);

  if (!aberto) return null;

  const entrar = async (event) => {
    event.preventDefault();
    if (!slug.trim() || !login.trim() || !senha) {
      setStatus("error");
      setMensagem("Preencha o restaurante, o usuário e a senha para continuar.");
      return;
    }

    setStatus("loading");
    setMensagem("");

    try {
      const usuario = await loginUsuario(login.trim(), senha, slug);
      onLogin(usuario);
      setStatus("success");
      setMensagem(`Bem-vindo, ${usuario.nome || usuario.login}. Abrindo seu painel...`);
      window.setTimeout(() => {
        window.location.assign(rotaDoPerfil(usuario.role, usuario.restaurante_slug));
      }, 650);
    } catch (error) {
      setStatus("error");
      setMensagem(error.message || "Não foi possível entrar agora.");
    }
  };

  return (
    <div className="lp-login-backdrop" onMouseDown={fechar}>
      <div
        className="lp-login-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-login-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="lp-icon-button lp-login-close"
          type="button"
          onClick={fechar}
          aria-label="Fechar login"
        >
          <X size={20} />
        </button>

        <aside className="lp-login-brand" aria-hidden="true">
          <img src="/logoGuia.png" alt="" />
          <div>
            <span className="lp-login-brand-label">Acesso seguro</span>
            <h2>O restaurante inteiro continua daqui.</h2>
            <p>
              Entre com o usuário criado pela administração e acesse apenas as
              áreas liberadas para o seu perfil.
            </p>
          </div>
          <div className="lp-login-signals">
            <span>
              <ShieldCheck size={17} /> Sessão protegida por token
            </span>
            <span>
              <Radio size={17} /> Operação sincronizada em tempo real
            </span>
          </div>
        </aside>

        <div className="lp-login-form-wrap">
          <div className="lp-login-heading">
            <span className="lp-login-kicker">
              <LockKeyhole size={15} /> Área do restaurante
            </span>
            <h2 id="lp-login-title">Acesse o Autenix</h2>
            <p>Use suas credenciais para abrir o painel do seu perfil.</p>
          </div>

          <form className="lp-login-form" onSubmit={entrar} noValidate>
            <label htmlFor="landing-restaurant">Restaurante</label>
            <div className="lp-restaurant-field">
              <Building2 size={18} aria-hidden="true" />
              <input
                id="landing-restaurant"
                name="restaurant"
                type="text"
                autoComplete="organization"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="codigo-do-restaurante"
                readOnly={Boolean(restauranteSlug)}
                disabled={status === "loading" || status === "success"}
              />
            </div>

            <label htmlFor="landing-login">Usuário</label>
            <input
              ref={loginRef}
              id="landing-login"
              name="login"
              type="text"
              autoComplete="username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="Seu usuário de acesso"
              disabled={status === "loading" || status === "success"}
            />

            <label htmlFor="landing-password">Senha</label>
            <div className="lp-password-field">
              <input
                id="landing-password"
                name="password"
                type={mostrarSenha ? "text" : "password"}
                autoComplete="current-password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Sua senha"
                disabled={status === "loading" || status === "success"}
              />
              <button
                className="lp-icon-button"
                type="button"
                onClick={() => setMostrarSenha((atual) => !atual)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            <div
              className={`lp-login-message ${status === "error" ? "is-error" : ""} ${status === "success" ? "is-success" : ""}`}
              role="status"
              aria-live="polite"
            >
              {status === "success" && <CheckCircle2 size={17} />}
              {mensagem}
            </div>

            <button
              className="lp-button lp-button-primary lp-login-submit"
              type="submit"
              disabled={status === "loading" || status === "success"}
            >
              {status === "loading" ? (
                <>
                  <span className="lp-spinner" /> Validando acesso
                </>
              ) : status === "success" ? (
                <>Acesso liberado</>
              ) : (
                <>
                  Entrar no restaurante <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="lp-login-help">
            O acesso é gerenciado pelo administrador do seu restaurante.
          </p>
        </div>
      </div>
    </div>
  );
}
