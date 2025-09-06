import { useEffect, useState } from 'react';
import {
    Button, useDisclosure, Modal, ModalOverlay, ModalContent,
    ModalHeader, ModalCloseButton, ModalBody, ModalFooter, FormControl,
    FormLabel, Input, RadioGroup, Radio, HStack, VStack, Slider,
    SliderTrack, SliderFilledTrack, SliderThumb, Tooltip, Box
} from '@chakra-ui/react';
import { SettingsIcon } from '@chakra-ui/icons';
import { useTopicAppearance, type TopicAppearance } from '@/Hooks/useTopicAppearance';

type Props = {
    topicId: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'solid' | 'outline' | 'ghost';
};

export default function AppearanceControls({ topicId, size = 'sm', variant = 'outline' }: Props) {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const { appearance, saveAppearance } = useTopicAppearance(topicId, { enabled: !!topicId });

    const [bgType, setBgType] = useState<'color' | 'image'>('color');
    const [bgColor, setBgColor] = useState('#1A202C');
    const [bgImageUrl, setBgImageUrl] = useState('');
    const [blur, setBlur] = useState(0);
    const [brightness, setBrightness] = useState(1);

    // Cuando abre el modal, precargamos desde el server
    useEffect(() => {
        if (!isOpen) return;
        const ap = appearance.data;
        setBgType(ap?.background?.type ?? 'color');
        setBgColor(ap?.background?.color ?? '#1A202C');
        setBgImageUrl(ap?.background?.imageUrl ?? '');
        setBlur(typeof ap?.overlay?.blur === 'number' ? ap!.overlay!.blur! : 0);
        setBrightness(typeof ap?.overlay?.brightness === 'number' ? ap!.overlay!.brightness! : 1);
    }, [isOpen, appearance.data]);

    const onSave = async () => {
        const patch: TopicAppearance = {
            background: bgType === 'color'
                ? { type: 'color', color: bgColor }
                : { type: 'image', imageUrl: bgImageUrl },
            overlay: { blur, brightness }
        };
        await saveAppearance.mutateAsync(patch);
        onClose();
    };

    return (
        <>
            <HStack spacing={2}>
                

                {/* Acceso rápido opcional */}
                <Tooltip label="Appearance" hasArrow>
                    <Button
                    size={size}
                    variant={variant}
                    leftIcon={<SettingsIcon />}
                    onClick={onOpen}
                    isDisabled={!topicId}
                >
                    Appearance
                </Button>
                </Tooltip>
            </HStack>

            <Modal isOpen={isOpen} onClose={onClose} size="lg">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Board appearance</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack align="stretch" spacing={6}>
                            {/* Background type */}
                            <FormControl>
                                <FormLabel>Background type</FormLabel>
                                <RadioGroup value={bgType} onChange={(v) => setBgType(v as 'color' | 'image')}>
                                    <HStack spacing={6}>
                                        <Radio value="color">Color</Radio>
                                        <Radio value="image">Image</Radio>
                                    </HStack>
                                </RadioGroup>
                            </FormControl>

                            {/* Color or Image URL */}
                            {bgType === 'color' ? (
                                <FormControl>
                                    <FormLabel>Background color</FormLabel>
                                    <HStack>
                                        <Input
                                            type="color"
                                            w="64px"
                                            p="0"
                                            value={bgColor}
                                            onChange={(e) => setBgColor(e.target.value)}
                                        />
                                        <Input
                                            value={bgColor}
                                            onChange={(e) => setBgColor(e.target.value)}
                                            placeholder="#1A202C"
                                        />
                                    </HStack>
                                </FormControl>
                            ) : (
                                <FormControl>
                                    <FormLabel>Image URL</FormLabel>
                                    <Input
                                        placeholder="https://..."
                                        value={bgImageUrl}
                                        onChange={(e) => setBgImageUrl(e.target.value)}
                                    />
                                </FormControl>
                            )}

                            {/* Overlay: blur / brightness */}
                            <VStack align="stretch" spacing={4}>
                                <FormControl>
                                    <FormLabel>Blur (px)</FormLabel>
                                    <HStack>
                                        <Box w="full">
                                            <Slider min={0} max={20} step={1} value={blur} onChange={setBlur}>
                                                <SliderTrack><SliderFilledTrack /></SliderTrack>
                                                <SliderThumb />
                                            </Slider>
                                        </Box>
                                        <Input w="80px" value={blur} onChange={(e) => setBlur(Number(e.target.value) || 0)} />
                                    </HStack>
                                </FormControl>

                                <FormControl>
                                    <FormLabel>Brightness</FormLabel>
                                    <HStack>
                                        <Box w="full">
                                            <Slider min={0.2} max={2} step={0.05} value={brightness} onChange={setBrightness}>
                                                <SliderTrack><SliderFilledTrack /></SliderTrack>
                                                <SliderThumb />
                                            </Slider>
                                        </Box>
                                        <Input
                                            w="80px"
                                            value={brightness}
                                            onChange={(e) => setBrightness(Number(e.target.value) || 1)}
                                        />
                                    </HStack>
                                </FormControl>
                            </VStack>
                        </VStack>
                    </ModalBody>

                    <ModalFooter>
                        <HStack>
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button
                                colorScheme="blue"
                                onClick={onSave}
                                isLoading={saveAppearance.isPending}
                            >
                                Save
                            </Button>
                        </HStack>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
