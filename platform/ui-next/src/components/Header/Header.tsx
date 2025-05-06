import React, { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Icons,
  Button,
} from '../';

import NavBar from '../NavBar';
const userAgent = navigator.userAgent || navigator.vendor || window.opera;
const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
  navigator.userAgent.toLowerCase()
);

interface HeaderProps {
  children?: ReactNode;
  menuOptions: Array<{
    title: string;
    icon?: string;
    onClick: () => void;
  }>;
  isReturnEnabled?: boolean;
  onClickReturnButton?: () => void;
  isSticky?: boolean;
  WhiteLabeling?: {
    createLogoComponentFn?: (React: any, props: any) => ReactNode;
  };
  PatientInfo?: ReactNode;
  Secondary?: ReactNode;
}

const Header: React.FC<HeaderProps> = ({
  children,
  menuOptions,
  isReturnEnabled = true,
  onClickReturnButton,
  isSticky = false,
  WhiteLabeling,
  PatientInfo,
  Secondary,
  ...props
}) => {
  const { t } = useTranslation('Header');

  // State to track if multiple monitors exist
  const [isMultiMonitor, setIsMultiMonitor] = useState(false);

  const isMultimonitorParam = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('multimonitor');
  };

  useEffect(() => {
    // Function to check multiple monitors using getScreenDetails()
    const checkMultiMonitor = async () => {
      if (isMultimonitorParam()) {
        setIsMultiMonitor(isMultimonitorParam());
      } else {
        if ('getScreenDetails' in window) {
          try {
            // Get screen details
            const screenDetails = await (window as any).getScreenDetails();

            // Set isMultiMonitor based on screen count
            setIsMultiMonitor(screenDetails.screens.length > 1);
          } catch (error) {
            console.error('Error getting screen details:', error);

            // If blocked or failed, check the 'multimonitor' parameter
          }
        } else {
          console.warn('getScreenDetails API is not supported in this browser.');

          // If API is not available, check the 'multimonitor' parameter
        }
      }
    };

    // Run check on mount
    checkMultiMonitor();

    return () => {};
  }, []);

  // Adjust position based on multi-monitor setup
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
    userAgent.toLowerCase()
  );

  const centerPosition = isMultiMonitor || isMobile ? 'left-[15%]' : 'left-[50%] -translate-x-1/2';
  const onClickReturn = () => {
    if (isReturnEnabled && onClickReturnButton) {
      onClickReturnButton();
    }
  };

  return (
    <NavBar
      isSticky={isSticky}
      {...props}
    >
      <div className="relative h-[62px] items-center">
        <div className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center">
          <div
            className={classNames(
              'mr-3 inline-flex items-center',
              isReturnEnabled && 'cursor-pointer'
            )}
            onClick={onClickReturn}
            data-cy="return-to-work-list"
          >
            {' '}
            {!isMobile && (
              <div className="ml-1">
                {WhiteLabeling?.createLogoComponentFn?.(React, props) || <Icons.OHIFLogo />}
              </div>
            )}
          </div>
        </div>
        <div className={`absolute ${centerPosition} top-1/2 -translate-y-1/2 transform`}>
          <div className="flex items-center justify-center space-x-2">{children}</div>
        </div>
        {isMultiMonitor && (
          <div className="absolute right-[15%] top-1/2 -translate-y-1/2 transform">
            <div className="flex items-center justify-center space-x-2">{children}</div>
          </div>
        )}
        <div className="absolute right-0 top-1/2 flex -translate-y-1/2 select-none items-center">
          {PatientInfo}
          <div className="border-primary-dark mx-1.5 h-[25px] border-r"></div>
          <div className="flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-active hover:bg-primary-dark mt-2 h-full w-full"
                >
                  <Icons.GearSettings />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {menuOptions.map((option, index) => {
                  const IconComponent = option.icon
                    ? Icons[option.icon as keyof typeof Icons]
                    : null;
                  return (
                    <DropdownMenuItem
                      key={index}
                      onSelect={option.onClick}
                      className="flex items-center gap-2 py-2"
                    >
                      {IconComponent && (
                        <span className="flex h-4 w-4 items-center justify-center">
                          <Icons.ByName name={IconComponent.name} />
                        </span>
                      )}
                      <span className="flex-1">{option.title}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </NavBar>
  );
};

export default Header;
