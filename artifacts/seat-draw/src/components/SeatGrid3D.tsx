import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, ContactShadows, Environment, Float, OrbitControls, RoundedBox, Sparkles, Text, Torus } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

type Assignment = Array<number | null>;

type SeatGrid3DProps = {
  rows: number;
  columns: number;
  assignment: Assignment | null;
  excludedSeats: Set<number>;
  priorityNumbers: Set<number>;
  frontPriority: boolean;
  onSwap: (sourceIndex: number, targetIndex: number) => void;
};

type CameraDirectorProps = {
  rows: number;
  columns: number;
  onComplete: () => void;
};

const seatGap = 1.35;

function getSeatPosition(index: number, rows: number, columns: number) {
  const row = Math.floor(index / columns);
  const column = index % columns;
  return {
    x: (column - (columns - 1) / 2) * seatGap,
    z: (row - (rows - 1) / 2) * seatGap,
  };
}

function CameraDirector({ rows, columns, onComplete }: CameraDirectorProps) {
  const { camera } = useThree();
  const startTime = useRef<number | null>(null);
  const completed = useRef(false);
  const centerZ = ((rows - 1) / 2) * seatGap;
  const target = useMemo(() => new THREE.Vector3(0, 0.8, 0), []);

  useFrame(({ clock }) => {
    if (completed.current) return;
    if (startTime.current === null) startTime.current = clock.getElapsedTime();
    const progress = Math.min((clock.getElapsedTime() - startTime.current) / 3.2, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const start = new THREE.Vector3(-Math.max(7, columns * 0.7), 4.4, centerZ + Math.max(8, rows * 0.9));
    const finish = new THREE.Vector3(0, Math.max(7, rows * 0.72), centerZ + Math.max(11, rows * 1.25));
    const arc = Math.sin(progress * Math.PI) * Math.max(2.5, columns * 0.22);
    camera.position.lerpVectors(start, finish, eased);
    camera.position.x += arc;
    camera.lookAt(target);
    if (progress === 1) {
      completed.current = true;
      onComplete();
    }
  });

  return null;
}

function ClassroomProps({ roomWidth, roomDepth, boardZ }: { roomWidth: number; roomDepth: number; boardZ: number }) {
  const windowPositions = [-roomDepth * 0.22, roomDepth * 0.08, roomDepth * 0.38];

  return (
    <>
      <mesh position={[0, 2.8, roomDepth / 2]} castShadow>
        <boxGeometry args={[roomWidth, 5.8, 0.18]} />
        <meshStandardMaterial color="#111c26" roughness={0.82} metalness={0.18} />
      </mesh>
      <mesh position={[-roomWidth / 2, 2.8, 0]} castShadow>
        <boxGeometry args={[0.18, 5.8, roomDepth]} />
        <meshStandardMaterial color="#111c26" roughness={0.82} metalness={0.18} />
      </mesh>
      <mesh position={[roomWidth / 2, 2.8, 0]} castShadow>
        <boxGeometry args={[0.18, 5.8, roomDepth]} />
        <meshStandardMaterial color="#111c26" roughness={0.82} metalness={0.18} />
      </mesh>

      {windowPositions.map((z, index) => (
        <group key={`window-${index}`} position={[roomWidth / 2 - 0.12, 3.1, z]} rotation={[0, Math.PI / 2, 0]}>
          <RoundedBox args={[2.8, 2.4, 0.12]} radius={0.05} smoothness={3}>
            <meshStandardMaterial color="#162936" roughness={0.2} metalness={0.5} />
          </RoundedBox>
          <mesh position={[0, 0, 0.08]}>
            <boxGeometry args={[2.35, 1.98, 0.04]} />
            <meshBasicMaterial color="#6ce4e1" transparent opacity={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.12]}>
            <boxGeometry args={[0.035, 1.98, 0.05]} />
            <meshBasicMaterial color="#a6d9d5" transparent opacity={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.12]}>
            <boxGeometry args={[2.35, 0.035, 0.05]} />
            <meshBasicMaterial color="#a6d9d5" transparent opacity={0.5} />
          </mesh>
          <pointLight position={[-0.4, 0.3, 0.5]} intensity={3.5} distance={5} color="#69d9d2" />
        </group>
      ))}

      <group position={[-roomWidth / 2 + 0.18, 2.05, roomDepth * 0.28]}>
        <RoundedBox args={[0.24, 4.1, 2.05]} radius={0.08} smoothness={3} castShadow>
          <meshStandardMaterial color="#26323d" roughness={0.48} metalness={0.48} />
        </RoundedBox>
        <mesh position={[0.14, 0, 0]}>
          <boxGeometry args={[0.05, 3.45, 1.45]} />
          <meshStandardMaterial color="#101a24" roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0.18, -0.82, 0.04]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color="#b7f36a" emissive="#6b9d36" emissiveIntensity={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0.17, 1.1, 0.04]}>
          <boxGeometry args={[0.04, 0.38, 0.78]} />
          <meshBasicMaterial color="#5eead4" transparent opacity={0.75} />
        </mesh>
      </group>

      <group position={[-roomWidth / 2 + 0.16, 1.85, roomDepth * 0.42]}>
        <RoundedBox args={[0.24, 3.7, 1.65]} radius={0.07} smoothness={3} castShadow>
          <meshStandardMaterial color="#303c47" roughness={0.45} metalness={0.42} />
        </RoundedBox>
        <mesh position={[0.16, 0, 0]}>
          <boxGeometry args={[0.06, 3.05, 1.05]} />
          <meshStandardMaterial color="#18232d" roughness={0.38} metalness={0.48} />
        </mesh>
        <mesh position={[0.2, -0.78, 0.04]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#ff6b7a" emissive="#a63e4e" emissiveIntensity={0.35} metalness={0.5} />
        </mesh>
      </group>

      <group position={[0, 0.62, boardZ + 1.4]}>
        <RoundedBox args={[3.5, 0.8, 1.25]} radius={0.1} smoothness={4} castShadow>
          <meshStandardMaterial color="#273540" roughness={0.36} metalness={0.58} />
        </RoundedBox>
        <mesh position={[0, 0.51, 0.08]} rotation={[-0.16, 0, 0]}>
          <boxGeometry args={[1.45, 0.08, 0.82]} />
          <meshStandardMaterial color="#101b25" emissive="#123f4a" emissiveIntensity={0.35} roughness={0.28} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.5, 0.52]}>
          <boxGeometry args={[1.15, 0.04, 0.03]} />
          <meshBasicMaterial color="#5eead4" transparent opacity={0.85} />
        </mesh>
        {[-1.25, 1.25].map((x) => (
          <mesh key={x} position={[x, -0.58, 0]}>
            <boxGeometry args={[0.12, 1.0, 0.12]} />
            <meshStandardMaterial color="#17252e" roughness={0.35} metalness={0.6} />
          </mesh>
        ))}
      </group>

      <group position={[0, 5.45, 0]}>
        {[-roomWidth * 0.3, 0, roomWidth * 0.3].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <boxGeometry args={[3.6, 0.06, 0.22]} />
            <meshBasicMaterial color="#c9f8f2" transparent opacity={0.42} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function Classroom({ rows, columns }: { rows: number; columns: number }) {
  const roomWidth = Math.max(18, columns * seatGap + 7);
  const roomDepth = Math.max(15, rows * seatGap + 8);
  const boardZ = -((rows - 1) / 2) * seatGap - 2.7;

  return (
    <>
      <color attach="background" args={['#070a0f']} />
      <fog attach="fog" args={['#070a0f', 18, 42]} />
      <ambientLight intensity={1.8} color="#dce7f0" />
      <directionalLight position={[4, 12, 8]} intensity={4} color="#dbeeff" castShadow />
      <pointLight position={[-8, 5, boardZ + 3]} intensity={42} distance={20} color="#5eead4" />
      <pointLight position={[8, 3, 5]} intensity={28} distance={18} color="#b7f36a" />
      <Environment preset="studio" background={false} environmentIntensity={0.45} />
      <ClassroomProps roomWidth={roomWidth} roomDepth={roomDepth} boardZ={boardZ} />
      <Sparkles count={90} scale={[roomWidth, 7, roomDepth]} size={2.2} speed={0.22} color="#d8f8ff" opacity={0.28} />
      <Float speed={0.65} rotationIntensity={0.12} floatIntensity={0.38}>
        <Torus args={[4.8, 0.025, 12, 72]} position={[-roomWidth * 0.32, 4.4, 1.8]} rotation={[Math.PI / 2, 0.2, 0.45]}>
          <meshBasicMaterial color="#5eead4" transparent opacity={0.28} />
        </Torus>
        <Torus args={[3.2, 0.018, 12, 72]} position={[roomWidth * 0.34, 3.8, -1.6]} rotation={[Math.PI / 2, -0.3, -0.35]}>
          <meshBasicMaterial color="#b7f36a" transparent opacity={0.2} />
        </Torus>
      </Float>
      <mesh position={[-roomWidth / 2 + 0.3, 3.5, 0]}>
        <boxGeometry args={[0.04, 7, roomDepth]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.18} />
      </mesh>
      <mesh position={[roomWidth / 2 - 0.3, 3.5, 0]}>
        <boxGeometry args={[0.04, 7, roomDepth]} />
        <meshBasicMaterial color="#b7f36a" transparent opacity={0.14} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial color="#0d141c" roughness={0.7} metalness={0.32} />
      </mesh>
      <gridHelper args={[Math.max(roomWidth, roomDepth), 24, '#31414e', '#151f28']} position={[0, -0.1, 0]} />
      <ContactShadows position={[0, -0.08, 0]} opacity={0.42} scale={Math.max(roomWidth, roomDepth)} blur={2.2} far={8} color="#061b1c" />
      <RoundedBox args={[Math.min(roomWidth - 2.5, 17), 3.35, 0.26]} position={[0, 3.2, boardZ]} radius={0.12} smoothness={5} castShadow>
        <meshStandardMaterial color="#283542" roughness={0.28} metalness={0.68} />
      </RoundedBox>
      <RoundedBox args={[Math.min(roomWidth - 3.2, 16.3), 2.72, 0.3]} position={[0, 3.27, boardZ + 0.16]} radius={0.07} smoothness={4}>
        <meshStandardMaterial color="#060b11" emissive="#0d4b52" emissiveIntensity={0.32} roughness={0.42} metalness={0.5} />
      </RoundedBox>
      <mesh position={[0, 1.43, boardZ + 0.22]} castShadow>
        <boxGeometry args={[Math.min(roomWidth - 2, 17), 0.14, 0.38]} />
        <meshStandardMaterial color="#5eead4" emissive="#1a766e" emissiveIntensity={0.34} roughness={0.24} metalness={0.78} />
      </mesh>
      <Text position={[0, 3.27, boardZ + 0.34]} rotation={[0, 0, 0]} fontSize={0.42} color="#d8f8ff" anchorX="center" anchorY="middle">
        SEAT / SYSTEM
      </Text>
    </>
  );
}

function Seat3D({
  index,
  rows,
  columns,
  number,
  excluded,
  priority,
  isDragging,
  isTarget,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  index: number;
  rows: number;
  columns: number;
  number: number | null;
  excluded: boolean;
  priority: boolean;
  isDragging: boolean;
  isTarget: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
}) {
  const { x, z } = getSeatPosition(index, rows, columns);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const baseY = excluded ? 0.16 : 0.38;
  const variant = index % 4;
  const baseRotation = ((index * 37) % 17 - 8) * 0.035;
  const primaryColor = excluded ? '#431f2b' : priority ? '#b7f36a' : number === null ? '#263642' : '#1d2933';
  const accentColor = excluded ? '#ff6b7a' : priority ? '#d9ff9d' : variant === 1 ? '#5eead4' : '#405a6c';
  const revealStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (number !== null) revealStartRef.current = null;
  }, [number]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (number !== null && revealStartRef.current === null) revealStartRef.current = clock.getElapsedTime();
    const revealProgress = number === null || revealStartRef.current === null
      ? 1
      : THREE.MathUtils.clamp((clock.getElapsedTime() - revealStartRef.current - index * 0.035) / 0.62, 0, 1);
    const revealEase = 1 - Math.pow(1 - revealProgress, 3);
    const targetY = isDragging ? baseY + 0.55 : baseY + (1 - revealEase) * 1.7;
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.16);
    const targetScale = isDragging || hovered ? 1.08 : revealEase;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.16);
    if (isDragging) groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 3) * 0.035;
    else groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, baseRotation, 0.16);
  });

  return (
    <group
      ref={groupRef}
      position={[x, baseY, z]}
      rotation={[0, baseRotation, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (number !== null) onDragStart(index);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        onDragOver(index);
      }}
      onPointerOut={() => setHovered(false)}
      onPointerUp={(event) => {
        event.stopPropagation();
        onDrop(index);
      }}
    >
      {variant === 0 && (
        <>
          <RoundedBox args={[1.16, 0.14, 0.88]} position={[0, 0.38, 0]} radius={0.1} smoothness={4} castShadow>
            <meshStandardMaterial color={primaryColor} emissive={isTarget ? '#77d7aa' : isDragging ? '#d58b54' : '#000000'} emissiveIntensity={isTarget || isDragging ? 0.5 : 0} roughness={0.4} metalness={0.16} />
          </RoundedBox>
          {[[-0.42, 0.2, -0.29], [0.42, 0.2, -0.29], [-0.42, 0.2, 0.29], [0.42, 0.2, 0.29]].map(([legX, legY, legZ]) => (
            <mesh key={`${legX}-${legZ}`} position={[legX, legY, legZ]} castShadow>
              <boxGeometry args={[0.07, 0.38, 0.07]} />
              <meshStandardMaterial color="#111c26" roughness={0.38} metalness={0.68} />
            </mesh>
          ))}
          <RoundedBox args={[0.78, 0.12, 0.58]} position={[0, 0.12, 0.62]} radius={0.08} smoothness={4} castShadow>
            <meshStandardMaterial color={accentColor} roughness={0.52} metalness={0.12} />
          </RoundedBox>
          <RoundedBox args={[0.78, 0.5, 0.1]} position={[0, 0.42, 0.84]} radius={0.06} smoothness={3} castShadow>
            <meshStandardMaterial color={accentColor} roughness={0.55} metalness={0.1} />
          </RoundedBox>
        </>
      )}
      {variant === 1 && (
        <>
          <mesh position={[0, 0.48, 0]} rotation={[0, Math.PI / 6, 0]} castShadow>
            <cylinderGeometry args={[0.76, 0.62, 0.16, 6]} />
            <meshStandardMaterial color={primaryColor} emissive={isTarget ? '#77d7aa' : '#000000'} emissiveIntensity={isTarget ? 0.55 : 0} roughness={0.34} metalness={0.24} />
          </mesh>
          <mesh position={[0, 0.22, 0]} castShadow>
            <coneGeometry args={[0.42, 0.52, 5]} />
            <meshStandardMaterial color="#182631" roughness={0.34} metalness={0.72} />
          </mesh>
          <mesh position={[0, 0.1, 0.54]} rotation={[-0.12, 0, 0]} castShadow>
            <boxGeometry args={[0.7, 0.1, 0.48]} />
            <meshStandardMaterial color={accentColor} roughness={0.45} metalness={0.18} />
          </mesh>
        </>
      )}
      {variant === 2 && (
        <>
          <mesh position={[0, 0.44, 0]} rotation={[0.12, Math.PI / 4, 0]} castShadow>
            <octahedronGeometry args={[0.76, 0]} />
            <meshStandardMaterial color={primaryColor} emissive={isDragging ? '#d58b54' : '#000000'} emissiveIntensity={isDragging ? 0.6 : 0} roughness={0.3} metalness={0.28} />
          </mesh>
          <mesh position={[0, 0.12, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.3, 0.6, 4]} />
            <meshStandardMaterial color="#111c26" roughness={0.38} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.3, 0.64]} rotation={[0.05, 0, 0]} castShadow>
            <boxGeometry args={[0.62, 0.1, 0.5]} />
            <meshStandardMaterial color={accentColor} roughness={0.5} metalness={0.18} />
          </mesh>
        </>
      )}
      {variant === 3 && (
        <>
          <mesh position={[0, 0.45, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <boxGeometry args={[1.02, 0.14, 1.02]} />
            <meshStandardMaterial color={primaryColor} emissive={isTarget ? '#77d7aa' : '#000000'} emissiveIntensity={isTarget ? 0.55 : 0} roughness={0.36} metalness={0.22} />
          </mesh>
          <mesh position={[0, 0.17, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
            <coneGeometry args={[0.52, 0.58, 4]} />
            <meshStandardMaterial color="#0f1922" roughness={0.34} metalness={0.74} />
          </mesh>
          <mesh position={[0, 0.34, 0.62]} rotation={[0.04, 0.1, 0]} castShadow>
            <boxGeometry args={[0.74, 0.1, 0.48]} />
            <meshStandardMaterial color={accentColor} roughness={0.48} metalness={0.2} />
          </mesh>
        </>
      )}
      {(excluded || number !== null) && (
        <Billboard position={[0, 0.82, 0.1]} follow lockX={false} lockY={false} lockZ={false}>
          <Text
            fontSize={0.3}
            color={excluded ? '#ffb7c0' : priority ? '#112018' : '#d8f8ff'}
            anchorX="center"
            anchorY="middle"
            depthOffset={-2}
            outlineWidth={0.018}
            outlineColor={excluded ? '#2c1119' : priority ? '#5d8a35' : '#061016'}
          >
            {excluded ? 'X' : String(number)}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

function SceneContents({
  rows,
  columns,
  assignment,
  excludedSeats,
  priorityNumbers,
  frontPriority,
  onSwap,
}: SeatGrid3DProps) {
  const [introDone, setIntroDone] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const seatCount = rows * columns;

  return (
    <>
      <CameraDirector rows={rows} columns={columns} onComplete={() => setIntroDone(true)} />
      <Classroom rows={rows} columns={columns} />
      <EffectComposer multisampling={4}>
        <Bloom intensity={0.65} luminanceThreshold={0.36} luminanceSmoothing={0.28} mipmapBlur />
        <Vignette eskil={false} offset={0.16} darkness={0.72} />
        <Noise opacity={0.035} premultiply />
      </EffectComposer>
      {Array.from({ length: seatCount }, (_, index) => {
        const number = assignment?.[index] ?? null;
        return (
          <Seat3D
            key={`3d-seat-${index}`}
            index={index}
            rows={rows}
            columns={columns}
            number={number}
            excluded={excludedSeats.has(index + 1)}
            priority={frontPriority && number !== null && priorityNumbers.has(number)}
            isDragging={draggedIndex === index}
            isTarget={targetIndex === index && draggedIndex !== index}
            onDragStart={(seatIndex) => {
              if (assignment?.[seatIndex] === null || assignment?.[seatIndex] === undefined) return;
              setDraggedIndex(seatIndex);
              setTargetIndex(seatIndex);
            }}
            onDragOver={(seatIndex) => {
              if (draggedIndex !== null && seatIndex !== draggedIndex) setTargetIndex(seatIndex);
            }}
            onDrop={(seatIndex) => {
              if (draggedIndex !== null && seatIndex !== draggedIndex) onSwap(draggedIndex, seatIndex);
              setDraggedIndex(null);
              setTargetIndex(null);
            }}
          />
        );
      })}
      <OrbitControls enabled={introDone && draggedIndex === null} enablePan={false} minDistance={8} maxDistance={34} maxPolarAngle={Math.PI / 2.05} target={[0, 0.8, 0]} />
    </>
  );
}

export function SeatGrid3D(props: SeatGrid3DProps) {
  const { rows, columns } = props;
  return (
    <div className="scene3d-shell">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 6, Math.max(15, rows * 1.3)], fov: 42 }}>
        <SceneContents {...props} />
      </Canvas>
      <div className="scene3d-overlay" aria-hidden="true">
        <span>3D CLASSROOM</span>
        <span>드래그로 좌석을 교환하고 화면을 움직여 둘러보세요</span>
      </div>
    </div>
  );
}
