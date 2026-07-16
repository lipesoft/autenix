import { useId, useRef, useState } from "react";
import { Image, Link, LoaderCircle, Upload, X } from "lucide-react";
import { API_URL } from "../../services/api.js";
import "./ImageUploadField.css";

const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp,image/gif";
const MAX_IMAGE_MB = 3;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

function montarUrlUpload(uploadPath) {
  if (!uploadPath) return "";
  if (/^https?:\/\//i.test(uploadPath)) return uploadPath;
  return `${API_URL}${uploadPath.startsWith("/") ? uploadPath : `/${uploadPath}`}`;
}

function resolverHeaders(headers) {
  if (typeof headers === "function") return headers();
  return headers || {};
}

export default function ImageUploadField({
  label = "Imagem",
  value,
  onChange,
  uploadPath,
  uploadFields = {},
  headers,
  hint = "JPG, PNG, WEBP ou GIF ate 3MB.",
  previewAlt = "Previa da imagem",
  disabled = false,
}) {
  const inputId = useId();
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState({ tipo: "idle", mensagem: "" });
  const uploadUrl = montarUrlUpload(uploadPath);
  const enviando = status.tipo === "loading";

  const enviarArquivo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      setStatus({ tipo: "error", mensagem: `Imagem acima de ${MAX_IMAGE_MB}MB.` });
      return;
    }

    if (!ACCEPTED_IMAGES.split(",").includes(file.type)) {
      setStatus({ tipo: "error", mensagem: "Use JPG, PNG, WEBP ou GIF." });
      return;
    }

    if (!uploadUrl) {
      setStatus({ tipo: "error", mensagem: "Upload indisponivel neste formulario." });
      return;
    }

    const formData = new FormData();
    formData.append("imagem", file);
    Object.entries(uploadFields || {}).forEach(([campo, valor]) => {
      if (valor !== undefined && valor !== null && valor !== "") {
        formData.append(campo, String(valor));
      }
    });

    setStatus({ tipo: "loading", mensagem: "Enviando imagem..." });
    try {
      const resposta = await fetch(uploadUrl, {
        method: "POST",
        headers: resolverHeaders(headers),
        body: formData,
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        throw new Error(dados.erro || "Nao foi possivel enviar a imagem.");
      }
      onChange(dados.url);
      setStatus({ tipo: "success", mensagem: "Imagem enviada." });
    } catch (error) {
      setStatus({ tipo: "error", mensagem: error.message });
    }
  };

  return (
    <div className="iu-field">
      <div className="iu-label">
        <Image size={15} />
        {label}
      </div>

      <div className={`iu-control ${value ? "iu-control-has-image" : ""}`}>
        <div className="iu-preview" aria-hidden={!value}>
          {value ? (
            <img src={value} alt={previewAlt} onError={(event) => (event.currentTarget.style.display = "none")} />
          ) : (
            <Image size={24} />
          )}
        </div>

        <div className="iu-panel">
          <div className="iu-actions">
            <input
              ref={fileInputRef}
              id={inputId}
              type="file"
              accept={ACCEPTED_IMAGES}
              disabled={disabled || enviando}
              onChange={enviarArquivo}
            />
            <button
              type="button"
              className="iu-button iu-button-primary"
              disabled={disabled || enviando}
              onClick={() => fileInputRef.current?.click()}
            >
              {enviando ? <LoaderCircle className="iu-spin" size={16} /> : <Upload size={16} />}
              {enviando ? "Enviando" : "Enviar imagem"}
            </button>
            {value && (
              <button
                type="button"
                className="iu-button iu-button-ghost"
                disabled={disabled || enviando}
                onClick={() => {
                  onChange("");
                  setStatus({ tipo: "idle", mensagem: "" });
                }}
                aria-label="Remover imagem"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {hint && <small className="iu-hint">{hint}</small>}
          {status.mensagem && (
            <small className={`iu-status iu-status-${status.tipo}`} role="status">
              {status.mensagem}
            </small>
          )}
        </div>
      </div>

      <details className="iu-url">
        <summary>
          <Link size={14} />
          Informar URL manualmente
        </summary>
        <input
          type="url"
          value={value || ""}
          disabled={disabled || enviando}
          onChange={(event) => {
            onChange(event.target.value);
            setStatus({ tipo: "idle", mensagem: "" });
          }}
          placeholder="https://.../imagem.png"
        />
      </details>
    </div>
  );
}
