import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../Dialog';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  contentClassName?: string;
  shouldCloseOnEsc?: boolean;
  shouldCloseOnOverlayClick?: boolean;
  containerClassName?: string;
  // Add optional position prop
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  shouldCloseOnEsc = true,
  shouldCloseOnOverlayClick = true,
  containerClassName,
// Destructure the new position prop
}) => {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => !open && onClose()}
      shouldCloseOnEsc={shouldCloseOnEsc}
      shouldCloseOnOverlayClick={shouldCloseOnOverlayClick}
     // Optionally disable overlay when positioned
    >
      <DialogContent className={containerClassName}>
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        <div className={cn('mt-2')}>{children}</div>
      </DialogContent>
    </Dialog>
  );
};

export default Modal;
