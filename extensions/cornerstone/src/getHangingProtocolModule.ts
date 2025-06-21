import { fourUp } from './hps/fourUp';
import { main3D } from './hps/main3D';
import { mpr } from './hps/mpr';
import { mprAnd3DVolumeViewport } from './hps/mprAnd3DVolumeViewport';
import { only3D } from './hps/only3D';
import { primary3D } from './hps/primary3D';
import { primaryAxial } from './hps/primaryAxial';
import { frameView } from './hps/frameView';
import { frame } from './hps/frame';

function getHangingProtocolModule() {
  const isMultiMonitor = window?.location?.href?.includes('multimonitor');

  const protocols = [
     {
      name: mpr.id,
      protocol: mpr,
    },
    {
      name: frame.id,
      protocol: frame,
    },
    {
      name: mprAnd3DVolumeViewport.id,
      protocol: mprAnd3DVolumeViewport,
    },
    {
      name: fourUp.id,
      protocol: fourUp,
    },
    {
      name: main3D.id,
      protocol: main3D,
    },
    {
      name: primaryAxial.id,
      protocol: primaryAxial,
    },
    {
      name: only3D.id,
      protocol: only3D,
    },
    {
      name: primary3D.id,
      protocol: primary3D,
    },
    {
      name: frameView.id,
      protocol: frameView,
    },
  ];

  // Remove any false/null entries (e.g., if mpr is excluded)
  return protocols.filter(Boolean);
}

export default getHangingProtocolModule;
