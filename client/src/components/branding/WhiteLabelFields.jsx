import { Building2, CheckCircle2, MessageCircle, Palette } from "lucide-react";
import ImageUploadField from "../upload/ImageUploadField.jsx";
import {
  normalizarWhiteLabel,
  WHITE_LABEL_PADRAO,
} from "./white-label-config.js";
import "./WhiteLabelFields.css";

export default function WhiteLabelFields({
  value,
  onChange,
  uploadPath,
  uploadFields,
  uploadHeaders,
}) {
  const dados = normalizarWhiteLabel(value);
  const corPrincipalSegura = /^#[0-9a-f]{6}$/i.test(dados.cor_primaria)
    ? dados.cor_primaria
    : WHITE_LABEL_PADRAO.cor_primaria;
  const corDestaqueSegura = /^#[0-9a-f]{6}$/i.test(dados.cor_secundaria)
    ? dados.cor_secundaria
    : WHITE_LABEL_PADRAO.cor_secundaria;
  const corTextoPrincipalSegura = /^#[0-9a-f]{6}$/i.test(dados.cor_texto_principal)
    ? dados.cor_texto_principal
    : WHITE_LABEL_PADRAO.cor_texto_principal;
  const corTextoSecundarioSegura = /^#[0-9a-f]{6}$/i.test(dados.cor_texto_secundario)
    ? dados.cor_texto_secundario
    : WHITE_LABEL_PADRAO.cor_texto_secundario;
  const corTituloSegura = /^#[0-9a-f]{6}$/i.test(dados.cor_titulo)
    ? dados.cor_titulo
    : WHITE_LABEL_PADRAO.cor_titulo;
  const corTextoInversoSegura = /^#[0-9a-f]{6}$/i.test(dados.cor_texto_inverso)
    ? dados.cor_texto_inverso
    : WHITE_LABEL_PADRAO.cor_texto_inverso;
  const alterar = (campo, novoValor) => onChange({ ...dados, [campo]: novoValor });

  const renderColorControl = (campo, valorSeguro, label, aria) => (
    <label className="wl-field">
      <span><Palette size={15} /> {label}</span>
      <div className="wl-color-control">
        <input
          type="color"
          value={valorSeguro}
          onChange={(event) => alterar(campo, event.target.value)}
          aria-label={`Selecionar ${aria}`}
        />
        <input
          value={dados[campo]}
          onChange={(event) => alterar(campo, event.target.value)}
          maxLength={7}
          aria-label={`${aria} hexadecimal`}
        />
      </div>
    </label>
  );

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

        <div className="wl-field wl-field-wide">
          <ImageUploadField
            label="Logo do restaurante"
            value={dados.logo_url}
            onChange={(logoUrl) => alterar("logo_url", logoUrl)}
            uploadPath={uploadPath}
            uploadFields={uploadFields}
            headers={uploadHeaders}
            hint="Use uma logo PNG, WEBP, JPG ou GIF ate 3MB."
            previewAlt="Previa da logo"
          />
        </div>

        <label className="wl-field wl-field-wide">
          <span><MessageCircle size={15} /> WhatsApp do restaurante</span>
          <input
            value={dados.whatsapp_numero}
            onChange={(event) => alterar("whatsapp_numero", event.target.value)}
            placeholder="Ex.: (11) 98888-7777"
            maxLength={32}
          />
          <small>Usado nos links de contato da reserva e no acompanhamento do cliente.</small>
        </label>

        {renderColorControl("cor_primaria", corPrincipalSegura, "Cor principal", "cor principal")}
        {renderColorControl("cor_secundaria", corDestaqueSegura, "Cor de destaque", "cor de destaque")}
        {renderColorControl("cor_titulo", corTituloSegura, "Cor dos titulos", "cor dos titulos")}
        {renderColorControl(
          "cor_texto_principal",
          corTextoPrincipalSegura,
          "Texto principal",
          "cor do texto principal",
        )}
        {renderColorControl(
          "cor_texto_secundario",
          corTextoSecundarioSegura,
          "Texto secundario",
          "cor do texto secundario",
        )}
        {renderColorControl(
          "cor_texto_inverso",
          corTextoInversoSegura,
          "Texto sobre destaque",
          "cor do texto sobre destaque",
        )}
      </div>

      <div
        className="wl-preview"
        style={{
          "--wl-primary": dados.cor_primaria,
          "--wl-accent": dados.cor_secundaria,
          "--wl-text": dados.cor_texto_principal,
          "--wl-muted": dados.cor_texto_secundario,
          "--wl-heading": dados.cor_titulo,
          "--wl-on-primary": dados.cor_texto_inverso,
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
      <div
        className="wl-text-preview"
        style={{
          "--wl-accent": dados.cor_secundaria,
          "--wl-text": dados.cor_texto_principal,
          "--wl-muted": dados.cor_texto_secundario,
          "--wl-heading": dados.cor_titulo,
        }}
      >
        <strong>Cardapio digital</strong>
        <span>Texto principal da experiencia do cliente.</span>
        <small>Texto secundario para descricoes, horarios e observacoes.</small>
      </div>
    </div>
  );
}
