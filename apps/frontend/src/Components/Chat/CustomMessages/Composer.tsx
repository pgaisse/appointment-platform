import { memo, useCallback, useRef, useState } from "react";
import { Box, Flex, HStack, IconButton, Input, Tooltip } from "@chakra-ui/react";
import { FiSend } from "react-icons/fi";
import { MdOutlinePostAdd } from "react-icons/md";
import PreviewBar from "../PreviewBar";
import ShowTemplateButton from "./ShowTemplateButton";
import CreateMessageModal from "./CreateCustomMessageModal";
import { FileUploadButton } from "../FileUploadButton";
import EmojiPickerButton from "./EmojiPickerButton";
import React from "react";
import { PreviewItem } from "@/types";


export const Composer = memo(function Composer({
  disabled,
  patientId,
  conversationId,
  onSend,
}: {
  disabled?: boolean;
  patientId: string;
  conversationId: string;
  onSend: (p: { text: string; files: File[] }) => void;
}) {
  // --- BORRADOR POR CONVERSACIÓN ---
  const storageKey = React.useMemo(
    () => `draft:${patientId}:${conversationId}`,
    [patientId, conversationId]
  );

  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cargar borrador guardado al montar/cambiar de conversación
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) setText(saved);
      else setText("");
    } catch {/* ignore */}
  }, [storageKey]);

  // Guardar borrador al escribir
  React.useEffect(() => {
    try {
      if (text && text.trim().length > 0) localStorage.setItem(storageKey, text);
      else localStorage.removeItem(storageKey);
    } catch {/* ignore */}
  }, [storageKey, text]);

  // --- RESTO IGUAL ---
  const hasText = text.trim().length > 0;

  const handleFilesReady = useCallback((files: File[]) => {
    setSelectedFiles(files);
    setPreviews(
      files.map((f) => ({
        id: `${f.name}-${f.size}-${f.lastModified}`,
        url: URL.createObjectURL(f),
        name: f.name,
        size: f.size,
      }))
    );
  }, []);

  const handleRemovePreview = useCallback((id: string) => {
    setPreviews((prev) => prev.filter((p) => p.id !== id));
    setSelectedFiles((prev) =>
      prev.filter((f) => `${f.name}-${f.size}-${f.lastModified}` !== id)
    );
  }, []);

  const handleClearPreviews = useCallback(() => {
    // liberar URLs creadas
    setPreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
    setSelectedFiles([]);
  }, []);

  const send = useCallback(() => {
    onSend({ text, files: selectedFiles });
    setText("");
    handleClearPreviews();
    try { localStorage.removeItem(storageKey); } catch {/* ignore */}
    if (inputRef.current) inputRef.current.focus();
  }, [onSend, text, selectedFiles, handleClearPreviews, storageKey]);

  // Limpieza de URLs si el componente se desmonta
  React.useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  return (
    <Box p={4} borderTop="1px solid #E2E8F0">
      <PreviewBar
        previews={previews}
        onRemove={handleRemovePreview}
        onClear={handleClearPreviews}
      />
      <Flex
        borderRadius="lg"
        border="1px solid #CBD5E0"
        px={3}
        py={2}
        align="center"
        gap={2}
        bg="white"
      >
        <HStack spacing={1}>
          <Tooltip label="Custom Messages">
            <ShowTemplateButton selectedPatient={patientId} onSelectTemplate={setText} />
          </Tooltip>
          <Tooltip label="Create Templates">
            <CreateMessageModal
              triggerButton={
                <IconButton
                  aria-label="Create template"
                  icon={<MdOutlinePostAdd size={20} />}
                  variant="ghost"
                  size="sm"
                />
              }
            />
          </Tooltip>
          <Tooltip label="Upload">
            <FileUploadButton
              onFilesReady={handleFilesReady}
              isSending={!!disabled}
              hasText={hasText}
            />
          </Tooltip>
          <Tooltip label="Emoji">
            <EmojiPickerButton inputRef={inputRef} value={text} setValue={setText} />
          </Tooltip>
        </HStack>

        <Input
          ref={inputRef}
          placeholder="Say something..."
          variant="unstyled"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          px={2}
          isDisabled={disabled}
        />

        <IconButton
          icon={<FiSend size={20} />}
          colorScheme="blue"
          onClick={send}
          aria-label="Send message"
          size="lg"
          borderRadius="xl"
          isDisabled={disabled || (!hasText && selectedFiles.length === 0)}
        />
      </Flex>
    </Box>
  );
});

