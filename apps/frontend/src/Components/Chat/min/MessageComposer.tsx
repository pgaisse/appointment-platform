import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  HStack,
  IconButton,
  InputGroup,
  InputRightElement,
  Kbd,
  Textarea,
  Tooltip,
  useBoolean,
  VStack,
  Menu,
  MenuButton,
  Button,
  MenuList,
  MenuItem,
  Spacer,
  Flex,
  Text,
} from '@chakra-ui/react';
import { AttachmentIcon, ArrowUpIcon, SmallCloseIcon } from '@chakra-ui/icons';
import { ChevronDownIcon } from 'lucide-react';
import type { MessageComposerProps, MessagePayload, TemplateItem } from './types';

function CharCounter({ value, max }: { value: number; max?: number }) {
  if (!max) return null;
  const tooLong = value > max;
  return (
    <Text fontSize="xs" opacity={0.7} color={tooLong ? 'red.400' : 'gray.500'}>
      {value}/{max}
    </Text>
  );
}

function FilesPreview({ files, onClear }: { files: File[]; onClear: () => void }) {
  if (!files.length) return null;
  return (
    <HStack spacing={2} wrap="wrap" mb={2}>
      {files.map((f, idx) => (
        <HStack key={`${f.name}-${idx}`} px={2} py={1} borderWidth="1px" borderRadius="md">
          <Text fontSize="xs" noOfLines={1} maxW="140px">{f.name}</Text>
          <IconButton aria-label="Remove file" size="xs" icon={<SmallCloseIcon />} onClick={onClear} variant="ghost" />
        </HStack>
      ))}
    </HStack>
  );
}

export default function MessageComposer({
  value,
  defaultValue,
  onChange,
  onSend,
  conversationId,
  to,
  org_id,
  metadata,
  placeholder = 'Type a message…',
  isLoading,
  disabled,
  maxLength,
  autoFocus,
  allowAttachments = false,
  compact = false,
  templates,
  onOpenTemplates,
  onAttachFiles,
  allowNewLines = true,
}: MessageComposerProps) {
  const [internal, setInternal] = useState<string>(defaultValue ?? '');
  const txt = typeof value === 'string' ? value : internal;
  const setTxt = (v: string) => (onChange ? onChange(v) : setInternal(v));

  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sending, setSending] = useBoolean(false);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const canSend = useMemo(() => {
    const hasText = txt.trim().length > 0;
    const hasFiles = files.length > 0;
    const notTooLong = maxLength ? txt.length <= maxLength : true;
    return !disabled && !isLoading && !sending && notTooLong && (hasText || hasFiles);
  }, [txt, files, maxLength, disabled, isLoading, sending]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    const isEnter = e.key === 'Enter';
    const isCtrlEnter = e.key === 'Enter' && (e.ctrlKey || e.metaKey);

    if (!allowNewLines && isEnter) {
      e.preventDefault();
      void doSend();
      return;
    }

    if (isCtrlEnter) {
      e.preventDefault();
      void doSend();
    }
  };

  const doSend = async () => {
    if (!canSend) return;
    setSending.on();
    try {
      const payload: MessagePayload = {
        body: txt.trim(),
        conversationId,
        to,
        org_id,
        metadata,
        media: files.map((f) => ({ name: f.name, type: f.type })),
      };
      await onSend?.(payload);
      if (files.length && onAttachFiles) onAttachFiles(files);
      setTxt('');
      setFiles([]);
      textareaRef.current?.focus();
    } finally {
      setSending.off();
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();
  const onFilesSelected: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;
    setFiles(selected);
    onAttachFiles?.(selected);
  };

  const applyTemplate = (tpl: TemplateItem) => {
    const next = (txt ? txt + (txt.endsWith('\n') ? '' : '\n') : '') + tpl.content;
    setTxt(next);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const el = textareaRef.current;
      if (el) {
        el.selectionStart = el.value.length;
        el.selectionEnd = el.value.length;
      }
    });
  };

  return (
    <VStack spacing={2} align="stretch" w="full">
      {allowAttachments && <FilesPreview files={files} onClear={() => setFiles([])} />}

      <Box borderWidth="1px" borderRadius="2xl" px={3} py={compact ? 1.5 : 2} bg="white" _dark={{ bg: 'gray.800' }} boxShadow="sm">
        <InputGroup>
          <Textarea
            ref={textareaRef}
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            resize="none"
            rows={compact ? 1 : 2}
            maxLength={maxLength}
            isDisabled={disabled || isLoading || sending}
            variant="unstyled"
            pr={allowAttachments ? '7.5rem' : '4rem'}
          />
          <InputRightElement w={allowAttachments ? '7.5rem' : '4rem'} h="full">
            <HStack spacing={1} justify="flex-end" h="full">
              {templates && templates.length > 0 && (
                <Menu placement="top">
                  <Tooltip label="Templates" hasArrow>
                    <MenuButton as={Button} size="sm" variant="ghost" rightIcon={<ChevronDownIcon size={16} />}>
                      Templates
                    </MenuButton>
                  </Tooltip>
                  <MenuList maxH="280px" overflowY="auto">
                    {templates.map((t) => (
                      <MenuItem key={t.id} onClick={() => applyTemplate(t)}>
                        {t.label}
                      </MenuItem>
                    ))}
                    {onOpenTemplates && (
                      <MenuItem onClick={onOpenTemplates}>Manage templates…</MenuItem>
                    )}
                  </MenuList>
                </Menu>
              )}

              {allowAttachments && (
                <>
                  <input ref={fileInputRef} type="file" hidden multiple onChange={onFilesSelected} />
                  <Tooltip label="Attach files" hasArrow>
                    <IconButton aria-label="Attach" size="sm" variant="ghost" icon={<AttachmentIcon />} onClick={openFilePicker} />
                  </Tooltip>
                </>
              )}

              <Tooltip label={allowNewLines ? (<><span>Send </span><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></>) : 'Send (Enter)'} hasArrow>
                <IconButton
                  aria-label="Send"
                  icon={<ArrowUpIcon />}
                  size="sm"
                  colorScheme="blue"
                  isDisabled={!canSend}
                  isLoading={isLoading || sending}
                  onClick={doSend}
                />
              </Tooltip>
            </HStack>
          </InputRightElement>
        </InputGroup>
      </Box>

      <Flex px={1} align="center" opacity={0.8} gap={3}>
        <CharCounter value={txt.length} max={maxLength} />
        <Spacer />
        {allowNewLines ? (
          <Text fontSize="xs" color="gray.500">
            Press <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> to send
          </Text>
        ) : (
          <Text fontSize="xs" color="gray.500">Press <Kbd>Enter</Kbd> to send</Text>
        )}
      </Flex>
    </VStack>
  );
}
