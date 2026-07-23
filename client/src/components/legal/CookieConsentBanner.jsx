import { useEffect, useState } from "react";
import { Cookie, Settings2, ShieldCheck, X } from "lucide-react";
import {
  COOKIE_CATEGORIES,
  DEFAULT_COOKIE_PREFERENCES,
  getCookieConsent,
  normalizarPreferenciasCookies,
  saveCookieConsent,
} from "./privacy-consent.js";
import "./CookieConsentBanner.css";

export default function CookieConsentBanner() {
  const [consentimento, setConsentimento] = useState(() => getCookieConsent());
  const [visivel, setVisivel] = useState(() => !getCookieConsent());
  const [preferenciasAberto, setPreferenciasAberto] = useState(false);
  const [preferences, setPreferences] = useState(
    () => getCookieConsent()?.preferences || DEFAULT_COOKIE_PREFERENCES,
  );

  useEffect(() => {
    const abrir = () => {
      const existente = getCookieConsent();
      setConsentimento(existente);
      setPreferences(existente?.preferences || DEFAULT_COOKIE_PREFERENCES);
      setPreferenciasAberto(true);
      setVisivel(true);
    };
    window.addEventListener("autenix:open-cookie-preferences", abrir);
    return () => window.removeEventListener("autenix:open-cookie-preferences", abrir);
  }, []);

  const salvar = (novasPreferencias, origem) => {
    const consent = saveCookieConsent(novasPreferencias, origem);
    setConsentimento(consent);
    setPreferences(consent.preferences);
    setPreferenciasAberto(false);
    setVisivel(false);
  };

  const aceitarTodos = () => {
    const todas = COOKIE_CATEGORIES.reduce((acc, categoria) => {
      acc[categoria.id] = true;
      return acc;
    }, {});
    salvar(todas, "accept_all");
  };

  const recusarOpcionais = () => {
    salvar(DEFAULT_COOKIE_PREFERENCES, "reject_optional");
  };

  const alternar = (categoria) => {
    if (categoria.required) return;
    setPreferences((atual) => ({
      ...atual,
      [categoria.id]: !atual[categoria.id],
    }));
  };

  return (
    <>
      {visivel && (
        <section
          className={`privacy-banner ${preferenciasAberto ? "is-expanded" : ""}`}
          aria-label="Preferencias de privacidade"
        >
          <div className="privacy-banner-main">
            <span className="privacy-banner-icon" aria-hidden="true">
              <Cookie size={21} />
            </span>
            <div>
              <strong>Privacidade no Autenix</strong>
              <p>
                Usamos somente recursos necessarios por padrao. Estatisticas,
                marketing e preferencias opcionais ficam bloqueados ate voce
                autorizar.
              </p>
              <div className="privacy-banner-links">
                <a href="/privacidade">Politica de Privacidade</a>
                <a href="/termos">Termos de Uso</a>
              </div>
            </div>
          </div>

          {preferenciasAberto && (
            <div className="privacy-preferences">
              {COOKIE_CATEGORIES.map((categoria) => (
                <label className="privacy-category" key={categoria.id}>
                  <span>
                    <strong>{categoria.title}</strong>
                    <small>{categoria.description}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences[categoria.id])}
                    disabled={categoria.required}
                    onChange={() => alternar(categoria)}
                  />
                </label>
              ))}
            </div>
          )}

          <div className="privacy-banner-actions">
            <button type="button" className="privacy-link-button" onClick={() => setPreferenciasAberto(true)}>
              <Settings2 size={16} /> Personalizar
            </button>
            <button type="button" className="privacy-secondary" onClick={recusarOpcionais}>
              Recusar nao essenciais
            </button>
            {preferenciasAberto && (
              <button
                type="button"
                className="privacy-secondary"
                onClick={() => salvar(normalizarPreferenciasCookies(preferences), "custom")}
              >
                Salvar preferencias
              </button>
            )}
            <button type="button" className="privacy-primary" onClick={aceitarTodos}>
              <ShieldCheck size={16} /> Aceitar todos
            </button>
          </div>

          {consentimento && (
            <button
              className="privacy-banner-close"
              type="button"
              onClick={() => setVisivel(false)}
              aria-label="Fechar preferencias"
            >
              <X size={18} />
            </button>
          )}
        </section>
      )}

      {!visivel && consentimento && (
        <button
          className="privacy-floating-button"
          type="button"
          onClick={() => {
            const existente = getCookieConsent();
            setConsentimento(existente);
            setPreferences(existente?.preferences || DEFAULT_COOKIE_PREFERENCES);
            setPreferenciasAberto(true);
            setVisivel(true);
          }}
        >
          Privacidade
        </button>
      )}
    </>
  );
}
