import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, OrbitControls, RoundedBox, Sparkles, Text, Torus } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
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
    const progress = Math.min((clock.getElapsedTime() - startTime.current) / 2.4, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const start = new THREE.Vector3(0, 5.2, centerZ + Math.max(10, rows * 1.1));
    const finish = new THREE.Vector3(0, Math.max(8, rows * 0.75), centerZ + Math.max(12, rows * 1.3));
    camera.position.lerpVectors(start, finish, eased);
    camera.lookAt(target);
    if (progress === 1) {
      completed.current = true;
      onComplete();
    }
  });

  return null;
}

function Classroom({ rows, columns }: { rows: number; columns: number }) {
  const roomWidth = Math.max(18, columns * seatGap + 7);
  const roomDepth = Math.max(15, rows * seatGap + 8);
  const boardZ = -((rows - 1) / 2) * seatGap - 2.7;

  return (
    <>
      <color attach="background" args={['#102d2c']} />
      <fog attach="fog" args={['#102d2c', 18, 42]} />
      <ambientLight intensity={1.5} color="#e7f2df" />
      <directionalLight position={[4, 12, 8]} intensity={3.5} color="#fff3d4" castShadow />
      <pointLight position={[-8, 5, boardZ + 3]} intensity={36} distance={20} color="#d58b54" />
      <Sparkles count={90} scale={[roomWidth, 7, roomDepth]} size={2.2} speed={0.22} color="#b4e8c2" opacity={0.42} />
      <Float speed={0.65} rotationIntensity={0.12} floatIntensity={0.38}>
        <Torus args={[4.8, 0.025, 12, 72]} position={[-roomWidth * 0.32, 4.4, 1.8]} rotation={[Math.PI / 2, 0.2, 0.45]}>
          <meshBasicMaterial color="#62d7ad" transparent opacity={0.38} />
        </Torus>
        <Torus args={[3.2, 0.018, 12, 72]} position={[roomWidth * 0.34, 3.8, -1.6]} rotation={[Math.PI / 2, -0.3, -0.35]}>
          <meshBasicMaterial color="#e0a160" transparent opacity={0.32} />
        </Torus>
      </Float>
      <mesh position={[-roomWidth / 2 + 0.3, 3.5, 0]}>
        <boxGeometry args={[0.08, 7, roomDepth]} />
        <meshBasicMaterial color="#4bd2a1" transparent opacity={0.24} />
      </mesh>
      <mesh position={[roomWidth / 2 - 0.3, 3.5, 0]}>
        <boxGeometry args={[0.08, 7, roomDepth]} />
        <meshBasicMaterial color="#e0a160" transparent opacity={0.18} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial color="#193f3b" roughness={0.78} metalness={0.08} />
      </mesh>
      <gridHelper args={[Math.max(roomWidth, roomDepth), 24, '#35645b', '#214c47']} position={[0, -0.1, 0]} />
      <RoundedBox args={[Math.min(roomWidth - 2.5, 17), 3.35, 0.26]} position={[0, 3.2, boardZ]} radius={0.12} smoothness={5} castShadow>
        <meshStandardMaterial color="#b9824f" roughness={0.42} metalness={0.18} />
      </RoundedBox>
      <RoundedBox args={[Math.min(roomWidth - 3.2, 16.3), 2.72, 0.3]} position={[0, 3.27, boardZ + 0.16]} radius={0.07} smoothness={4}>
        <meshStandardMaterial color="#123d3a" roughness={0.72} metalness={0.1} />
      </RoundedBox>
      <mesh position={[0, 1.43, boardZ + 0.22]} castShadow>
        <boxGeometry args={[Math.min(roomWidth - 2, 17), 0.14, 0.38]} />
        <meshStandardMaterial color="#d59a5f" roughness={0.38} metalness={0.22} />
      </mesh>
      <Text position={[0, 3.27, boardZ + 0.34]} rotation={[0, 0, 0]} fontSize={0.48} color="#f6f0d8" anchorX="center" anchorY="middle">
        칠판
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

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const targetY = isDragging ? baseY + 0.55 : baseY;
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.16);
    const targetScale = isDragging || hovered ? 1.08 : 1;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.16);
    if (isDragging) groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 3) * 0.035;
    else groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, 0.16);
  });

  return (
    <group
      ref={groupRef}
      position={[x, baseY, z]}
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
      <RoundedBox args={[1.16, 0.14, 0.88]} position={[0, 0.38, 0]} radius={0.1} smoothness={4} castShadow>
        <meshStandardMaterial
          color={excluded ? '#7b403b' : priority ? '#c87950' : number === null ? '#406762' : '#f5f0dc'}
          emissive={isTarget ? '#77d7aa' : isDragging ? '#d58b54' : '#000000'}
          emissiveIntensity={isTarget || isDragging ? 0.5 : 0}
          roughness={0.4}
          metalness={0.16}
        />
      </RoundedBox>
      {[[-0.42, 0.2, -0.29], [0.42, 0.2, -0.29], [-0.42, 0.2, 0.29], [0.42, 0.2, 0.29]].map(([legX, legY, legZ]) => (
        <mesh key={`${legX}-${legZ}`} position={[legX, legY, legZ]} castShadow>
          <boxGeometry args={[0.07, 0.38, 0.07]} />
          <meshStandardMaterial color="#244f4a" roughness={0.52} metalness={0.18} />
        </mesh>
      ))}
      <RoundedBox args={[0.78, 0.12, 0.58]} position={[0, 0.12, 0.62]} radius={0.08} smoothness={4} castShadow>
        <meshStandardMaterial color={excluded ? '#713a38' : priority ? '#b76549' : '#315b55'} roughness={0.52} metalness={0.12} />
      </RoundedBox>
      <RoundedBox args={[0.78, 0.5, 0.1]} position={[0, 0.42, 0.84]} radius={0.06} smoothness={3} castShadow>
        <meshStandardMaterial color={excluded ? '#8b4540' : priority ? '#cb7655' : '#376a62'} roughness={0.55} metalness={0.1} />
      </RoundedBox>
      {excluded ? (
        <Text position={[0, 0.62, 0]} fontSize={0.34} color="#ffd8c4" anchorX="center" anchorY="middle">
          X
        </Text>
      ) : number !== null ? (
        <Text position={[0, 0.62, 0]} fontSize={0.3} color={priority ? '#fff1df' : '#123b38'} anchorX="center" anchorY="middle">
          {String(number)}
        </Text>
      ) : null}
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
