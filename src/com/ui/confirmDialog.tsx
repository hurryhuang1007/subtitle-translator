'use client';

import { Button, Dialog, HStack, Portal, Text } from '@chakra-ui/react';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColorPalette?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  confirmColorPalette = 'red',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root
      role="alertdialog"
      open={open}
      onOpenChange={details => {
        if (loading && !details.open) return;
        onOpenChange(details.open);
      }}
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text color="fg.muted">{description}</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap={2} justify="flex-end" w="full">
                <Button variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
                  {cancelLabel}
                </Button>
                <Button
                  colorPalette={confirmColorPalette}
                  loading={loading}
                  onClick={() => void onConfirm()}
                >
                  {confirmLabel}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
