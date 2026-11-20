import React, { useEffect, useState } from 'react';
import { Server, Cpu, Network, Radio, Terminal } from 'lucide-react';
import { HuaweiOltView } from './HuaweiOltView';
import { MikroTikWebUiView } from './MikroTikWebUiView';
import { BdcomOltView } from './BdcomOltView';
import { VsolOltView } from './VsolOltView';

export type ProVendorId = 'huawei' | 'mikrotik' | 'bdcom' | 'vsol';

interface ProVendorWebUiHubProps {
  defaultHostIp?: string;
  initialVendor?: ProVendorId;
}

const VENDORS: Array<{
  id: ProVendorId;
  name: string;
  models: string;
  protocol: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'huawei',
    name: 'Huawei OLT',
    models: 'MA5608T · MA5683T · MA5800',
    protocol: 'GPON / XGS-PON',
    icon: Server,
  },
  {
    id: 'mikrotik',
    name: 'MikroTik ROS v7',
    models: 'RB5009 · CCR2004 · CCR2116 · CCR2216',
    protocol: 'BGP v7 / PPPoE / Bridge',
    icon: Cpu,
  },
  {
    id: 'bdcom',
    name: 'BDCOM OLT',
    models: 'P3310D · P3608B · P3616 · GP3600',
    protocol: 'EPON / GPON CTC',
    icon: Network,
  },
  {
    id: 'vsol',
    name: 'VSOL OLT',
    models: 'V1600D4/D8 · V1600G1/G2 · V3600G1',
    protocol: 'EPON / GPON OMCI',
    icon: Radio,
  },
];

export default function ProVendorWebUiHub({
  defaultHostIp,
  initialVendor = 'huawei',
}: ProVendorWebUiHubProps) {
  const [activeVendor, setActiveVendor] = useState<ProVendorId>(initialVendor);

  useEffect(() => {
    setActiveVendor(initialVendor);
  }, [initialVendor]);

  return (
    <div className="space-y-4">
      {/* Unified Vendor Switcher Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div className="flex items-center gap-2 px-2 py-1">
          <Terminal className="w-4 h-4 text-slate-700 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-900 whitespace-nowrap">
              Datasheet Pro WebUI · Live Telnet Sync
            </div>
            <div className="text-[11px] text-slate-500 whitespace-nowrap">
              WebUI পরিবর্তনের সাথে সাথেই Live Telnet CLI-তে রিয়েল-টাইম কমান্ড এক্সিকিউট হয়
            </div>
          </div>
        </div>

        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-1.5"
          role="tablist"
          aria-label="Pro Vendor WebUI Switcher"
        >
          {VENDORS.map((vendor) => {
            const Icon = vendor.icon;
            const isActive = activeVendor === vendor.id;
            return (
              <button
                key={vendor.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveVendor(vendor.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-500'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold leading-tight whitespace-nowrap">
                    {vendor.name}
                  </div>
                  <div
                    className={`text-[10px] leading-tight truncate ${
                      isActive ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {vendor.protocol}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Vendor Pro Workbench */}
      {activeVendor === 'huawei' && <HuaweiOltView defaultHostIp={defaultHostIp} />}
      {activeVendor === 'mikrotik' && <MikroTikWebUiView defaultHostIp={defaultHostIp} />}
      {activeVendor === 'bdcom' && <BdcomOltView defaultHostIp={defaultHostIp} />}
      {activeVendor === 'vsol' && <VsolOltView defaultHostIp={defaultHostIp} />}
    </div>
  );
}
