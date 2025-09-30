import React, { useEffect, useRef } from 'react';
import classnames from 'classnames';

import Button, { ButtonEnums } from '../Button';
import { Icons } from '@ohif/ui-next';

type NotificationAction = {
  id: string;
  text: string;
  value: any;
  type: ButtonEnums.type.primary | ButtonEnums.type.secondary;
  size?: ButtonEnums.size.small | ButtonEnums.size.medium;
};

export type NotificationProps = {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  message: string | React.ReactNode;
  actions: NotificationAction[];
  onSubmit: (e: any) => void;
  onOutsideClick?: () => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
};

const Notification: React.FC<NotificationProps> = ({
  id,
  type = 'info',
  message,
  actions,
  onSubmit,
  onOutsideClick = () => {},
  onKeyPress,
}) => {
  const notificationRef = useRef<HTMLDivElement>(null);

  // if it's an error → just console log and return nothing
  if (type === 'error') {
    console.error(`[Notification:${id}]`, message);
    return null;
  }

  useEffect(() => {
    const notificationElement = notificationRef.current;
    if (!notificationElement) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const isClickInside = notificationElement.contains(event.target as Node);
      if (!isClickInside) {
        onOutsideClick();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('mouseup', handleClick);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('mouseup', handleClick);
    };
  }, [onOutsideClick]);

  useEffect(() => {
    notificationRef.current?.focus();
  }, []);

  const iconsByType = {
    warning: { icon: 'notificationwarning-diamond', color: 'text-yellow-500' },
    info: { icon: 'notifications-info', color: 'text-primary-main' },
    success: { icon: 'info', color: 'text-green-500' },
  };

  const { icon, color } = iconsByType[type] || { icon: '', color: '' };

  return (
    <div
      ref={notificationRef}
      className="border-customblue-10 bg-customblue-400 mx-2 mt-2 flex flex-col rounded-md border-2 p-2 outline-none"
      data-cy={id}
      onKeyDown={onKeyPress}
      tabIndex={0}
    >
      <div className="flex grow items-center">
        <Icons.ByName
          name={icon}
          className={classnames('h-6 w-6', color)}
        />
        <span className="ml-2 text-[13px] text-white">{message}</span>
      </div>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        {actions?.map((action, index) => (
          <Button
            name={action.id}
            key={index}
            type={action.type}
            size={action.size || ButtonEnums.size.small}
            onClick={() => onSubmit(action.value)}
          >
            {action.text}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default Notification;
