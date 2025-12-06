// apps/frontend/src/Components/GoogleReview/GoogleReviewButton.tsx
import React from 'react';
import {
  IconButton,
  Button,
  MenuItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Text,
  Icon,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  VStack,
  Spinner,
  Box,
  Tooltip,
} from '@chakra-ui/react';
import { FaStar, FaCog, FaRedoAlt } from 'react-icons/fa';
import { useSendGoogleReview, useGoogleReviewSettings, useGoogleReviewRequests } from '@/Hooks/Query/useGoogleReviews';
import { useNavigate } from 'react-router-dom';

interface GoogleReviewButtonProps {
  appointmentId: string;
  variant?: 'icon' | 'button' | 'menu-item';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClose?: () => void; // For menu items to close parent menu
}

export const GoogleReviewButton: React.FC<GoogleReviewButtonProps> = ({
  appointmentId,
  variant = 'button',
  size = 'sm',
  disabled = false,
  onClose,
}) => {
  const { isOpen, onOpen, onClose: onModalClose } = useDisclosure();
  const { mutate: sendReview, isPending } = useSendGoogleReview();
  const { data: settings, isLoading: settingsLoading } = useGoogleReviewSettings();
  const { data: requests } = useGoogleReviewRequests(appointmentId);
  const navigate = useNavigate();

  // Check if last request failed
  const lastRequest = requests?.[0]; // Assuming sorted by most recent
  const hasFailedRequest = lastRequest?.status === 'failed';
  const isRetry = hasFailedRequest;

  // Validar si las reviews están configuradas correctamente
  const isConfigured = settings?.enabled && settings?.reviewUrl?.trim();

  // ✅ Verificar si ya se envió una solicitud recientemente
  const preventDays = settings?.preventDuplicateDays ?? 30;
  const hasRecentRequest = requests && requests.length > 0 && (() => {
    // Si preventDuplicateDays es 0, no hay restricción
    if (preventDays === 0) return false;
    
    const latest = requests[0];
    // Solo considerar requests exitosos (no failed)
    if (latest.status === 'failed') return false;
    
    const sentDate = new Date(latest.requestedAt);
    const daysSince = (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < preventDays;
  })();

  // Si ya hay una solicitud reciente y no es failed, mostrar estado "enviado"
  const showSentState = hasRecentRequest && !hasFailedRequest;

  const handleClick = () => {
    if (onClose) onClose(); // Close parent menu if exists
    onOpen();
  };

  const handleConfirm = () => {
    if (!isConfigured) {
      // No debería llegar aquí, pero por si acaso
      return;
    }

    sendReview(appointmentId, {
      onSuccess: () => {
        onModalClose();
      },
    });
  };

  const handleGoToSettings = () => {
    onModalClose();
    // Navigate to Settings page with Google Reviews tab (index 4)
    navigate('/settings?tab=4');
  };

  // ──────────────────────────────────────────────────────────────────
  // Render Variants
  // ──────────────────────────────────────────────────────────────────

  const renderButton = () => {
    // Si ya se envió y no se puede reenviar, mostrar badge de "enviado"
    if (showSentState) {
      switch (variant) {
        case 'icon':
          return (
            <Tooltip label="Review Sent" placement="top" hasArrow>
              <IconButton
                aria-label="Review Request Sent"
                icon={<Icon as={FaStar} />}
                colorScheme="green"
                size={size}
                isDisabled
              />
            </Tooltip>
          );

        case 'menu-item':
          return (
            <MenuItem icon={<Icon as={FaStar} />} isDisabled>
              Review Sent
            </MenuItem>
          );

        case 'button':
        default:
          return (
            <Button
              leftIcon={<Icon as={FaStar} />}
              colorScheme="green"
              size={size}
              variant="outline"
              isDisabled
            >
              Review Sent
            </Button>
          );
      }
    }

    // Estado normal: permitir enviar/reintentar
    switch (variant) {
      case 'icon':
        return (
          <Tooltip label="Send Review" placement="top" hasArrow>
            <IconButton
              aria-label="Request Google Review"
              icon={<Icon as={FaStar} />}
              colorScheme="yellow"
              size={size}
              onClick={handleClick}
              isDisabled={disabled}
            />
          </Tooltip>
        );

      case 'menu-item':
        return (
          <MenuItem icon={<Icon as={FaStar} />} onClick={handleClick} isDisabled={disabled}>
            Request Google Review
          </MenuItem>
        );

      case 'button':
      default:
        return (
          <Button
            leftIcon={<Icon as={FaStar} />}
            colorScheme="yellow"
            size={size}
            onClick={handleClick}
            isDisabled={disabled}
          >
            Request Review
          </Button>
        );
    }
  };

  return (
    <>
      {renderButton()}

      <Modal isOpen={isOpen} onClose={onModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {isConfigured ? 'Send Google Review Request' : 'Google Reviews Not Configured'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {settingsLoading ? (
              <Box textAlign="center" py={8}>
                <Spinner size="lg" color="blue.500" />
                <Text mt={3} fontSize="sm" color="gray.600">
                  Loading settings...
                </Text>
              </Box>
            ) : !isConfigured ? (
              <VStack spacing={4} align="stretch">
                <Alert status="warning" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Configuration Required</AlertTitle>
                    <AlertDescription>
                      Google Reviews are not configured or enabled. You need to set up your Google
                      review URL and enable the feature before sending review requests.
                    </AlertDescription>
                  </Box>
                </Alert>

                <Text fontSize="sm" color="gray.600">
                  To configure Google Reviews:
                </Text>
                <VStack align="stretch" pl={4} spacing={1}>
                  <Text fontSize="sm" color="gray.600">
                    1. Enable Google Reviews
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    2. Add your Google review URL
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    3. Customize your SMS message template
                  </Text>
                </VStack>
              </VStack>
            ) : (
              <>
                {hasFailedRequest && (
                  <Alert status="warning" borderRadius="md" mb={3}>
                    <AlertIcon />
                    <Box>
                      <AlertTitle>Previous Request Failed</AlertTitle>
                      <AlertDescription fontSize="sm">
                        The last review request failed to send. You can retry sending now.
                      </AlertDescription>
                    </Box>
                  </Alert>
                )}
                <Text>
                  This will send an SMS to the patient with a personalized message requesting a
                  Google Review.
                </Text>
                <Text mt={3} fontSize="sm" color="gray.600">
                  The message will include the patient's name and a direct link to your Google
                  review page.
                </Text>
              </>
            )}
          </ModalBody>

          <ModalFooter>
            {!isConfigured ? (
              <>
                <Button variant="ghost" mr={3} onClick={onModalClose}>
                  Cancel
                </Button>
                <Button
                  colorScheme="blue"
                  leftIcon={<Icon as={FaCog} />}
                  onClick={handleGoToSettings}
                >
                  Go to Settings
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" mr={3} onClick={onModalClose} isDisabled={isPending}>
                  Cancel
                </Button>
                <Button
                  colorScheme={isRetry ? 'orange' : 'yellow'}
                  leftIcon={<Icon as={isRetry ? FaRedoAlt : FaStar} />}
                  onClick={handleConfirm}
                  isLoading={isPending}
                  loadingText={isRetry ? 'Retrying...' : 'Sending...'}
                >
                  {isRetry ? 'Retry SMS' : 'Send SMS'}
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
