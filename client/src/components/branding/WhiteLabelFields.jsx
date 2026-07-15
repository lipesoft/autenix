import { Building2, CheckCircle2, Image, Palette } from "lucide-react";
import {
  normalizarWhiteLabel,
  WHITE_LABEL_PADRAO,
} from "./white-label-config.js";
import "./WhiteLabelFields.css";

export default function WhiteLabelFields({ value, onChange }) {
  const dados = normalizarWhiteLabel(value);
  const corPrincipalSegura = /^#[0-9a-f]{6}$/i.test(dados.cor_primaria)
    ? dados.cor_primaria
    : WHITE_LABEL_PADRAO.cor_primaria;
  const corDestaqueSegura = /^#[0-9a-f]{6}$/i.test(dados.cor_secundaria)
    ? dados.cor_secundaria
    : WHITE_LABEL_PADRAO.cor_secundaria;
  const alterar = (campo, novoValor) => onChange({ ...dados, [campo]: novoValor });

  return (
    <div className="wl-fields">
      <label className="wl-toggle-row">
        <span className="wl-toggle-copy">
          <strong>Ativar marca própria</strong>
          <small>Aplica nome, logo e cores em todas as áreas deste restaurante.</small>
        </span>
        <input
          type="checkbox"
          checked={Boolean(dados.white_label_ativo)}
          onChange={(event) => alterar("white_label_ativo", event.target.checked)}
        />
        <span className="wl-switch" aria-hidden="true" />
      </label>

      <div className="wl-grid">
        <label className="wl-field wl-field-wide">
          <span><Building2 size={15} /> Nome exibido</span>
          <input
            value={dados.nome_exibicao}
            onChange={(event) => alterar("nome_exibicao", event.target.value)}
            placeholder="Ex.: Restaurante Aurora"
            maxLength={80}
          />
        </label>

        <label className="wl-field wl-field-wide">
          <span><Image size={15} /> URL pública da logo</span>
          <input
            type="url"
            value={dados.logo_url}
            onChange={(event) => alterar("logo_url", event.target.value)}
            placeholder="https://.../logo.png"
          />
          <small>Use uma imagem HTTPS com fundo transparente.</small>
        </label>

        <label className="wl-field">
          <span><Palette size={15} /> Cor principal</span>
          <div className="wl-color-control">
            <input
              type="color"
              value={corPrincipalSegura}
              onChange={(event) => alterar("cor_primaria", event.target.value)}
              aria-label="Selecionar cor principal"
            />
            <input
              value={dados.cor_primaria}
              onChange={(event) => alterar("cor_primaria", event.target.value)}
              maxLength={7}
              aria-label="Cor principal hexadecimal"
            />
          </div>
        </label>

        <label className="wl-field">
          <span><Palette size={15} /> Cor de destaque</span>
          <div className="wl-color-control">
            <input
              type="color"
              value={corDestaqueSegura}
              onChange={(event) => alterar("cor_secundaria", event.target.value)}
              aria-label="Selecionar cor de destaque"
            />
            <input
              value={dados.cor_secundaria}
              onChange={(event) => alterar("cor_secundaria", event.target.value)}
              maxLength={7}
              aria-label="Cor de destaque hexadecimal"
            />
          </div>
        </label>
      </div>

      <div
        className="wl-preview"
        style={{
          "--wl-primary": dados.cor_primaria,
          "--wl-accent": dados.cor_secundaria,
        }}
      >
        <div className="wl-preview-brand">
          {dados.logo_url ? (
            <img src={dados.logo_url} alt="Prévia da logo" />
          ) : (
            <span><Building2 size={22} /></span>
          )}
          <div>
            <strong>{dados.nome_exibicao || "Nome do restaurante"}</strong>
            <small>Painel de operação</small>
          </div>
        </div>
        <div className="wl-preview-action"><CheckCircle2 size={16} /> Pedido confirmado</div>
      </div>
    </div>
  );
}
