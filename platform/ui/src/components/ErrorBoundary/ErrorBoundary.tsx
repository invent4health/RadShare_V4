// import React, { useState } from 'react';
// import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
// import PropTypes from 'prop-types';
// import { useTranslation } from 'react-i18next';
// import i18n from 'i18next';

// import Modal from '../Modal';
// import IconButton from '../IconButton';
// import { Icons } from '@ohif/ui-next';
// const isProduction = process.env.NODE_ENV === 'production';

// const DefaultFallback = ({ error, context, resetErrorBoundary = () => {}, fallbackRoute }) => {
//   const { t } = useTranslation('ErrorBoundary');
//   const [showDetails, setShowDetails] = useState(false);
//   const title = `${t('Something went wrong')}${!isProduction && ` ${t('in')} ${context}`}.`;
//   const subtitle = t('Sorry, something went wrong there. Try again.');
//   return (
//     <div
//       className="ErrorFallback bg-primary-dark h-full w-full"
//       role="alert"
//     >
//       <p className="text-primary-light text-xl">{title}</p>
//       <p className="text-primary-light text-base">{subtitle}</p>
//       {!isProduction && (
//         <div className="bg-secondary-dark mt-5 space-y-2 rounded-md p-5 font-mono">
//           <p className="text-primary-light">
//             {t('Context')}: {context}
//           </p>
//           <p className="text-primary-light">
//             {t('Error Message')}: {error.message}
//           </p>

//           <IconButton
//             variant="contained"
//             color="inherit"
//             size="initial"
//             className="text-primary-active"
//             onClick={() => setShowDetails(!showDetails)}
//           >
//             <React.Fragment>
//               <div>{t('Stack Trace')}</div>
//               <Icons.ChevronOpen />
//             </React.Fragment>
//           </IconButton>

//           {showDetails && (
//             <pre className="text-primary-light whitespace-pre-wrap px-4">Stack: {error.stack}</pre>
//           )}
//         </div>
//       )}
//     </div>
//   );
// };

// DefaultFallback.propTypes = {
//   error: PropTypes.object.isRequired,
//   resetErrorBoundary: PropTypes.func,
//   componentStack: PropTypes.string,
// };

// const ErrorBoundary = ({
//   context = 'OHIF',
//   onReset = () => {},
//   onError = () => {},
//   fallbackComponent: FallbackComponent = DefaultFallback,
//   children,
//   fallbackRoute = null,
//   isPage,
// }) => {
//   const [isOpen, setIsOpen] = useState(true);

//   const onErrorHandler = (error, componentStack) => {
//     console.error(`${context} Error Boundary`, error, componentStack, context);
//     onError(error, componentStack, context);
//   };

//   const onResetHandler = (...args) => onReset(...args);

//   // In production, return null instead of showing error dialog
//   if (isProduction) {
//     return null;
//   }

//   const withModal = Component => props => (
//     <Modal
//       closeButton
//       shouldCloseOnEsc
//       isOpen={isOpen}
//       title={i18n.t('ErrorBoundary:Something went wrong')}
//       onClose={() => {
//         setIsOpen(false);
//         if (fallbackRoute && typeof window !== 'undefined') {
//           window.location = fallbackRoute;
//         }
//       }}
//     >
//       <Component {...props} />
//     </Modal>
//   );

//   const Fallback = isPage ? FallbackComponent : withModal(FallbackComponent);

//   return (
//     <ReactErrorBoundary
//       fallbackRender={props => (
//         <Fallback
//           {...props}
//           context={context}
//           fallbackRoute={fallbackRoute}
//         />
//       )}
//       onReset={onResetHandler}
//       onError={onErrorHandler}
//     >
//       {children}
//     </ReactErrorBoundary>
//   );
// };

// ErrorBoundary.propTypes = {
//   context: PropTypes.string,
//   onReset: PropTypes.func,
//   onError: PropTypes.func,
//   fallbackComponent: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
//   children: PropTypes.node.isRequired,
//   fallbackRoute: PropTypes.string,
// };

// export default ErrorBoundary;
import React, { useState, useEffect } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Icons } from '@ohif/ui-next';

const isProduction = process.env.NODE_ENV === 'production';

interface ErrorBoundaryError extends Error {
  message: string;
  stack?: string;
}

interface DefaultFallbackProps {
  error: ErrorBoundaryError;
  context: string;
  resetErrorBoundary: () => void;
}

interface ErrorBoundaryProps {
  context?: string;
  onReset?: () => void;
  onError?: (error: ErrorBoundaryError, componentStack: string, context: string) => void;
  fallbackComponent?: React.ComponentType<DefaultFallbackProps>;
  children: React.ReactNode;
  fallbackRoute?: string | null;
  isPage?: boolean;
}

const DefaultFallback = ({
  error,
  context,
  resetErrorBoundary = () => {},
}: DefaultFallbackProps) => {
  const { t } = useTranslation('ErrorBoundary');
  const [showDetails, setShowDetails] = useState(false);
  const title = `${t('Something went wrong lets see')}${
    !isProduction ? ` ${t('in')} ${context}` : ''
  }.`;
  const subtitle = t('Sorry, something went wrong there. Try again.');

  const copyErrorDetails = () => {
    const errorDetails = `
Context: ${context}
Error Message: ${error.message}
Stack: ${error.stack}
    `;
    navigator.clipboard.writeText(errorDetails);
    toast.success(t('Copied to clipboard'));
  };

  useEffect(() => {
    // Suppress any error toast popups to hide red popup
  }, [error]);
  // In production, we suppress UI unless details explicitly requested

  return (
    <>
      {!isProduction && showDetails && (
        <div className="error-boundary-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4">
          <div className="border-input bg-gray-950 h-[50vh] w-full max-w-[900px] rounded border-2 shadow-lg">
            <div className="text-muted-foreground flex items-center justify-between border-b border-gray-800 px-6 py-4 text-xl">
              <div className="flex items-center gap-2">{title}</div>
              <button
                onClick={() => {
                  copyErrorDetails();
                  setShowDetails(false);
                }}
                className="text-aqua-pale hover:text-aqua-pale/80 flex items-center gap-2 rounded bg-gray-800 px-4 py-2 text-base font-light"
              >
                <Icons.Code className="h-4 w-4" />
                {t('Copy Details')}
              </button>
            </div>

            <div className="px-6 py-3 text-lg text-gray-300">{subtitle}</div>

            <div className="h-[calc(100%-136px)] overflow-y-auto px-6 pb-6">
              <div className="text-aqua-pale space-y-4 font-mono text-base">
                <p className="break-words text-lg">
                  {t('Context')}: {context}
                </p>
                <p className="break-words text-lg">
                  {t('Error Message')}: {error.message}
                </p>
                <pre className="whitespace-pre-wrap break-words rounded bg-gray-900 p-4">
                  Stack: {error.stack}
                </pre>
              </div>
            </div>

            <div className="flex justify-end border-t border-gray-800 px-6 py-4">
              <button
                onClick={() => setShowDetails(false)}
                className="rounded bg-gray-800 px-4 py-2 text-base text-white hover:bg-gray-700"
              >
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const ErrorBoundary = ({
  context = 'OHIF',
  onReset = () => {},
  onError = () => {},
  fallbackComponent: FallbackComponent = DefaultFallback,
  children,
  fallbackRoute = null,
  isPage,
}: ErrorBoundaryProps) => {
  const [error, setError] = useState<ErrorBoundaryError | null>(null);

  const onResetHandler = () => {
    setError(null);
    onReset();
  };

  // Add error event listener to window
  const onErrorHandler = React.useCallback(
    (error: Error, info: { componentStack: string }) => {
      console.debug(`${context} Error Boundary`, error, info?.componentStack, context);
      onError(error as ErrorBoundaryError, info?.componentStack, context);
    },
    [context, onError]
  );

  useEffect(() => {
    let errorTimeout: NodeJS.Timeout;

    const handleError = (event: ErrorEvent) => {
      event.preventDefault();
      clearTimeout(errorTimeout);
      errorTimeout = setTimeout(() => {
        setError(event.error);
        onErrorHandler(event.error, null);
      }, 100);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      clearTimeout(errorTimeout);
      errorTimeout = setTimeout(() => {
        setError(event.reason);
        onErrorHandler(event.reason, null);
      }, 100);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      clearTimeout(errorTimeout);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [onErrorHandler]);

  return (
    <ReactErrorBoundary
      fallbackRender={(props: { error: Error; resetErrorBoundary: () => void }) => (
        <FallbackComponent
          error={props.error}
          context={context}
          resetErrorBoundary={props.resetErrorBoundary}
        />
      )}
      onReset={onResetHandler}
      onError={onErrorHandler}
    >
      <>
        {children}
        {error && (
          <FallbackComponent
            error={error}
            context={context}
            resetErrorBoundary={() => setError(null)}
          />
        )}
      </>
    </ReactErrorBoundary>
  );
};

export default ErrorBoundary;
