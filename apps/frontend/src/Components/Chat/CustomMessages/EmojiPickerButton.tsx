// EmojiPickerButton.tsx
import {
  Box,
  IconButton,
  Tooltip,
  useOutsideClick,
} from "@chakra-ui/react";
import { FaSmile } from "react-icons/fa";
import { useRef, useState } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";

export default function EmojiPickerButton({
  inputRef,
  value,
  setValue,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  setValue: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const boxRef = useRef(null);

  useOutsideClick({
    ref: boxRef,
    handler: () => setIsOpen(false),
  });

  const insertAtCursor = (text: string) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;

    const newText = value.slice(0, start) + text + value.slice(end);
    setValue(newText);

    // Mantener el cursor después del emoji insertado
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const handleEmojiClick = (emojiData: any) => {
    insertAtCursor(emojiData.emoji);
    setIsOpen(false);
  };

  return (
    <Box position="relative" ref={boxRef}>
      <Tooltip label="Emojis">
        <IconButton
          aria-label="Emoji"
          icon={<FaSmile />}
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
        />
      </Tooltip>

      {isOpen && (
        <Box position="absolute" bottom="40px" zIndex="popover">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.LIGHT}
            autoFocusSearch={false}
          />
        </Box>
      )}
    </Box>
  );
}
