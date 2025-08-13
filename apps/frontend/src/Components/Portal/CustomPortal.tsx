import {
  Box,
  CloseButton,
  Portal,
  PortalProps,
} from "@chakra-ui/react";
import {
  ReactNode,
  RefObject,
  useEffect,
  useState,
  forwardRef,
  ForwardedRef,
} from "react";

type Props = PortalProps & {
  children?: ReactNode;
  onClose: () => void;
};

const CustomPortal = forwardRef<HTMLDivElement, Props>(
  ({ children, onClose, ...portalProps }, ref) => {
    const [style, setStyle] = useState({});

    const isRefObject = (
      ref: ForwardedRef<HTMLDivElement>
    ): ref is RefObject<HTMLDivElement> =>
      ref !== null && typeof ref !== "function";

    useEffect(() => {
      if (!isRefObject(ref)) return;
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      setStyle({
        position: "absolute",
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
    }, [ref]);

    return (
      <Portal containerRef={isRefObject(ref) ? ref : undefined} {...portalProps}>
        <Box style={style} bg="white" color="white" zIndex={9999}>
          <CloseButton
            position="absolute"
            zIndex={9999}
            top="8px"
            right="8px"
            mb={10}
            onClick={onClose}
            color="red"
          />
          {children}
        </Box>
      </Portal>
    );
  }
);

export default CustomPortal;
