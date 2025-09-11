'use client';

import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import styles from '@/styles/Home.module.css';
import {
  formatChatMessageLinks,
  LiveKitRoom,
  LocalUserChoices,
  PreJoin,
  VideoConference,
} from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPreset,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import React from 'react';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
  username?: string;
  hideButtons?: boolean;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const preJoinDefaults = React.useMemo(() => {
    return {
      username: props.username || '',
      videoEnabled: false,
      audioEnabled: false,
    };
  }, [props.username]);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
    url.searchParams.append('roomName', props.roomName);
    url.searchParams.append('participantName', values.username);
    if (props.region) {
      url.searchParams.append('region', props.region);
    }
    const connectionDetailsResp = await fetch(url.toString());
    const connectionDetailsData = await connectionDetailsResp.json();
    setConnectionDetails(connectionDetailsData);
  }, []);
  const handlePreJoinError = React.useCallback((e: any) => console.error(e), []);

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <PreJoin
            defaults={preJoinDefaults}
            onSubmit={handlePreJoinSubmit}
            onError={handlePreJoinError}
          />
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{ codec: props.codec, hq: props.hq }}
          hideButtons={props.hideButtons}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
  };
  hideButtons?: boolean;
}) {
  // 完全禁用E2EE加密功能
  const e2eeEnabled = false;
  const keyProvider = new ExternalE2EEKeyProvider();
  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(true); // 直接设为true
  // 屏幕共享强制1080p超高码率配置 - 25Mbps码率，30fps，强制高质量
  const _screenSharePreset = new VideoPreset(1920, 1080, 25_000_000, 30, 'high');
  
  // 创建更高码率的自定义预设 - 30Mbps确保足够的码率余量
  const _highBitratePreset = new VideoPreset(1920, 1080, 30_000_000, 30, 'high');

  const roomOptions = React.useMemo((): RoomOptions => {
    // 强制使用H.264编码
    const videoCodec: VideoCodec = 'h264';
    
    return {
      videoCaptureDefaults: {
        deviceId: props.userChoices.videoDeviceId ?? undefined,
        resolution: VideoPresets.h1080,
        // 优化屏幕捕获设置以改善色彩
        facingMode: undefined,
      },
      publishDefaults: {
        dtx: false,
        // 完全禁用simulcast - 这是关键！
        videoSimulcastLayers: [],
        red: false, // 关闭冗余编码
        videoCodec,
        // 屏幕共享使用超高码率和优化的编码设置
        screenShareEncoding: {
          ...(_highBitratePreset.encoding),
          // 优化H.264编码参数以改善色彩
          maxBitrate: 30_000_000,
          maxFramerate: 30,
        },
        // 屏幕共享完全禁用simulcast，强制单层超高码率
        screenShareSimulcastLayers: [],
        // 强制屏幕共享参数
        forceStereo: false,
        // 禁用背景噪声抑制
        stopMicTrackOnMute: false,
      },
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
        // 保持音频处理功能以确保音质
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      // 完全关闭自适应流 - 这是防止码率下降的关键
      adaptiveStream: false,
      // 关闭动态投播
      dynacast: false,
      // 关闭加密
      e2ee: undefined,
      // 禁用断线重连时的码率调整
      disconnectOnPageLeave: true,
    };
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), []);

  // 手动配置屏幕共享参数，防止码率被自动调整并优化色彩
  React.useEffect(() => {
    const handleTrackPublished = (publication: any, participant: any) => {
      if (publication.source === 'screen_share' && participant.isLocal) {
        console.log('屏幕共享已开始，应用高码率和色彩优化配置');
        // 对于本地屏幕共享，确保使用我们预设的高码率配置
        const track = publication.track;
        if (track && 'sender' in track) {
          // 类型断言为LocalVideoTrack
          const localTrack = track as any;
          if (localTrack.sender) {
            localTrack.sender.getParameters().then((params: any) => {
              if (params.encodings && params.encodings.length > 0) {
                // 强制设置最高码率和优化编码参数
                params.encodings[0].maxBitrate = 30_000_000; // 30Mbps
                params.encodings[0].minBitrate = 20_000_000; // 最低20Mbps
                params.encodings[0].maxFramerate = 30;
                // 优化编码质量参数
                params.encodings[0].priority = 'high';
                params.encodings[0].networkPriority = 'high';
                return localTrack.sender.setParameters(params);
              }
            }).then(() => {
              console.log('屏幕共享码率和质量参数设置成功');
            }).catch(console.error);
          }
        }
      }
    };

    room.on('trackPublished', handleTrackPublished);
    
    return () => {
      room.off('trackPublished', handleTrackPublished);
    };
  }, [room]);

  // 优化屏幕捕获约束以改善色彩质量
  React.useEffect(() => {
    // 重写getDisplayMedia以添加色彩优化约束
    const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
    
    navigator.mediaDevices.getDisplayMedia = function(constraints: any) {
      // 优化屏幕捕获约束
      const optimizedConstraints = {
        ...constraints,
        video: {
          ...constraints?.video,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 30 },
          // 优化色彩和质量设置
          aspectRatio: { ideal: 16/9 },
          resizeMode: 'none',
          // 强制高质量捕获
          displaySurface: 'monitor',
        }
      };
      
      console.log('使用优化的屏幕捕获约束:', optimizedConstraints);
      return originalGetDisplayMedia.call(this, optimizedConstraints);
    };

    return () => {
      // 恢复原始方法
      navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
    };
  }, []);

  // E2EE功能已完全禁用，无需相关逻辑

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
      // 优化屏幕共享连接选项
      maxRetries: 3,
      peerConnectionTimeout: 15000,
      // 禁用自适应码率调整
      rtcConfig: {
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
      },
    };
  }, []);

  // 添加调试信息，监控码率变化
  React.useEffect(() => {
    const handleTrackPublished = (publication: any) => {
      if (publication.source === 'screen_share') {
        console.log('屏幕共享轨道已发布:', publication);
        console.log('编码设置:', publication.track?.sender?.getParameters());
        
        // 定期检查码率
        const checkBitrate = setInterval(() => {
          if (publication.track?.sender) {
            publication.track.sender.getStats().then((stats: any) => {
              stats.forEach((report: any) => {
                if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
                  console.log('当前发送码率:', Math.round(report.bytesSent * 8 / 1000), 'kbps');
                  console.log('目标码率:', report.targetBitrate);
                }
              });
            });
          }
        }, 2000);

        // 清理定时器
        publication.on('unmuted', () => clearInterval(checkBitrate));
      }
    };

    room.on('trackPublished', handleTrackPublished);
    
    return () => {
      room.off('trackPublished', handleTrackPublished);
    };
  }, [room]);

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  return (
    <>
      <LiveKitRoom
        connect={e2eeSetupComplete}
        room={room}
        token={props.connectionDetails.participantToken}
        serverUrl={props.connectionDetails.serverUrl}
        connectOptions={connectOptions}
        video={props.userChoices.videoEnabled}
        audio={props.userChoices.audioEnabled}
        onDisconnected={handleOnLeave}
        onEncryptionError={handleEncryptionError}
        onError={handleError}
        className={props.hideButtons ? styles.hideButtons : undefined}
      >
        <VideoConference
          chatMessageFormatter={formatChatMessageLinks}
          SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
        />
        <DebugMode />
        <RecordingIndicator />
      </LiveKitRoom>
    </>
  );
}


