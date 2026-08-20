import * as THREE from "three";
import { spawn, move } from "multithreading";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

export type SerializedMesh = {
  type: "Mesh";
  name: string;
  geometry: {
    position: Float32Array;
    normal: Float32Array | null;
    uv: Float32Array | null;
    index: Uint16Array | Uint32Array | null;
  };
  materialName: string;
};

export type SerializedGroup = {
  type: "Group";
  name: string;
  children: SerializedObject[];
};

export type SerializedObject = SerializedMesh | SerializedGroup;

const textureLoader = new THREE.TextureLoader();

export const hashToServer = (hash: string) => {
  let i = 31;
  for (const c of hash) {
    i ^= c.charCodeAt(0);
  }
  return i % 8;
};

const buildMaterialMap = async (mtlText: string) => {
  const materialMap: Record<string, THREE.MeshStandardMaterial> = {};
  let currentMaterialName: string | null = null;
  const lines = mtlText.split(/\r?\n/);

  const texturePromises: Promise<void>[] = [];
  const textureCache: Record<string, THREE.Texture> = {};

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("newmtl ")) {
      currentMaterialName = trimmedLine.substring(7).trim();
    } else if (currentMaterialName && trimmedLine.startsWith("map_Kd ")) {
      const matName = currentMaterialName;
      const parts = trimmedLine.split(/\s+/);
      const textureHash = parts[parts.length - 1];
      if (!textureHash) continue;

      const promise = new Promise<void>((resolve) => {
        const cached = textureCache[textureHash];
        if (cached) {
          materialMap[matName] = new THREE.MeshStandardMaterial({
            map: cached,
            metalness: 0.1,
            roughness: 0.8,
            alphaTest: 0.5,
          });
          resolve();
          return;
        }

        const textureUrl =
          textureHash.startsWith("http://") ||
          textureHash.startsWith("https://")
            ? textureHash
            : `https://t${hashToServer(textureHash)}.rbxcdn.com/${textureHash}`;

        let currentBlobUrl: string | null = null;

        fetch(textureUrl)
          .then((res) => {
            if (!res.ok) throw new Error(`Texture fetch failed: ${res.status}`);
            return res.blob();
          })
          .then(
            (blob) =>
              new Promise<THREE.Texture>((resolveTex, rejectTex) => {
                currentBlobUrl = URL.createObjectURL(blob);
                textureLoader.load(
                  currentBlobUrl,
                  resolveTex,
                  undefined,
                  rejectTex,
                );
              }),
          )
          .then((tex) => {
            tex.flipY = true;
            tex.colorSpace = THREE.SRGBColorSpace;

            if (currentBlobUrl) {
              tex.userData = { blobUrl: currentBlobUrl };
            }
            textureCache[textureHash] = tex;
            materialMap[matName] = new THREE.MeshStandardMaterial({
              map: tex,
              metalness: 0.1,
              roughness: 0.8,
              alphaTest: 0.5,
            });
            resolve();
          })
          .catch((err) => {
            console.error("Failed to load texture for material", matName, err);

            resolve();
          });
      });

      texturePromises.push(promise);
    }
  }

  await Promise.all(texturePromises);

  return materialMap;
};

export const dispose3DObject = (obj: THREE.Object3D | null) => {
  if (!obj) return;
  obj.traverse((child: any) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : child.material
          ? [child.material]
          : [];
      materials.forEach((material: any) => {
        if (material.map) {
          if (material.map.userData?.blobUrl) {
            URL.revokeObjectURL(material.map.userData.blobUrl);
          }
          material.map.dispose();
        }
        material.dispose?.();
      });
    }
  });
};

export const disposeAvatarObject = dispose3DObject;

export type ObjectType = "avatar" | "asset";

interface Load3DObjectOptions {
  type: ObjectType;
  id: string | number;
  cookie: string;
  objectName?: string;
}

const fetchManifestUrl = async (
  type: ObjectType,
  id: string | number,
  cookie: string,
): Promise<string> => {
  if (type === "avatar") {
    const result = await window.api.getAvatar3DManifest(cookie, id);
    if (result.state === "Pending" || result.state === "InReview") {
      throw new Error(`Thumbnail ${result.state.toLowerCase()}`);
    }
    if (!result.imageUrl) {
      throw new Error("Thumbnail not ready");
    }
    return result.imageUrl;
  } else {
    const result = await window.api.getAsset3DManifest(cookie, id);
    return result.imageUrl;
  }
};

const reconstructObject = (data: SerializedObject): THREE.Object3D => {
  if (data.type === "Mesh") {
    const meshData = data as SerializedMesh;
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(meshData.geometry.position, 3),
    );
    if (meshData.geometry.normal) {
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(meshData.geometry.normal, 3),
      );
    }
    if (meshData.geometry.uv) {
      geometry.setAttribute(
        "uv",
        new THREE.BufferAttribute(meshData.geometry.uv, 2),
      );
    }
    if (meshData.geometry.index) {
      geometry.setIndex(new THREE.BufferAttribute(meshData.geometry.index, 1));
    }

    const material = new THREE.MeshStandardMaterial({
      name: meshData.materialName,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = meshData.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  } else {
    const groupData = data as SerializedGroup;
    const group = new THREE.Group();
    group.name = groupData.name;
    groupData.children.forEach((child) => group.add(reconstructObject(child)));
    return group;
  }
};

const loadFromManifest = async (
  manifestUrl: string,
  objectName: string,
): Promise<THREE.Object3D> => {
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok)
    throw new Error(`Failed to fetch manifest: ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();

  const resolveField = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === "string") return val;
    if (typeof val === "object") {
      if (typeof val.hash === "string") return val.hash;
      if (typeof val.url === "string") return val.url;
    }
    return null;
  };

  const mtlVal =
    resolveField(manifest.mtl) ||
    resolveField(manifest.mtlHash) ||
    resolveField(manifest.material);
  const objVal =
    resolveField(manifest.obj) ||
    resolveField(manifest.objHash) ||
    resolveField(manifest.object);

  if (!mtlVal || !objVal)
    throw new Error("MTL or OBJ hash missing in manifest.");

  const makeUrl = (val: string) => {
    if (val.startsWith("http")) return val;
    return `https://t${hashToServer(val)}.rbxcdn.com/${val}`;
  };

  const mtlUrl = makeUrl(mtlVal);
  const objUrl = makeUrl(objVal);

  const mtlTextResponse = await fetch(mtlUrl);
  if (!mtlTextResponse.ok)
    throw new Error(`Failed to load MTL: ${mtlTextResponse.status}`);
  const mtlText = await mtlTextResponse.text();

  const materialMap = await buildMaterialMap(mtlText);

  const objTextResponse = await fetch(objUrl);
  if (!objTextResponse.ok)
    throw new Error(`Failed to load OBJ: ${objTextResponse.status}`);
  const objText = await objTextResponse.text();

  const parseObjAndCenterMain = (objText: string) => {
    const loader = new OBJLoader();
    const object = loader.parse(objText);

    const box = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const translateGeometry = (geometry: THREE.BufferGeometry) => {
      geometry.translate(-center.x, -center.y, -center.z);
    };

    const serialize = (obj: THREE.Object3D): any => {
      if ((obj as any).isMesh) {
        const mesh = obj as THREE.Mesh;
        const geo = mesh.geometry;

        translateGeometry(geo);

        let index: Uint16Array | Uint32Array | null = null;
        if (geo.index) {
          index = geo.index.array as Uint16Array | Uint32Array;
        }

        return {
          type: "Mesh",
          name: mesh.name,
          geometry: {
            position: geo.attributes.position.array as Float32Array,
            normal: geo.attributes.normal
              ? (geo.attributes.normal.array as Float32Array)
              : null,
            uv: geo.attributes.uv
              ? (geo.attributes.uv.array as Float32Array)
              : null,
            index,
          },
          materialName: Array.isArray(mesh.material)
            ? mesh.material[0].name
            : (mesh.material as THREE.Material).name,
        };
      } else {
        return {
          type: "Group",
          name: obj.name,
          children: obj.children.map(serialize),
        };
      }
    };

    return serialize(object);
  };

  let resultValue: any = null;

  try {
    const handle = spawn(move(objText), async (text) => {
      const THREE = await import("three");
      const { OBJLoader } =
        await import("three/examples/jsm/loaders/OBJLoader.js");

      const parseObjAndCenter = (objText: string) => {
        const loader = new OBJLoader();
        const object = loader.parse(objText);

        const box = new THREE.Box3().setFromObject(object);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const translateGeometry = (geometry: THREE.BufferGeometry) => {
          geometry.translate(-center.x, -center.y, -center.z);
        };

        const serialize = (obj: THREE.Object3D): any => {
          if ((obj as any).isMesh) {
            const mesh = obj as THREE.Mesh;
            const geo = mesh.geometry;

            translateGeometry(geo);

            let index: Uint16Array | Uint32Array | null = null;
            if (geo.index) {
              index = geo.index.array as Uint16Array | Uint32Array;
            }

            return {
              type: "Mesh",
              name: mesh.name,
              geometry: {
                position: geo.attributes.position.array as Float32Array,
                normal: geo.attributes.normal
                  ? (geo.attributes.normal.array as Float32Array)
                  : null,
                uv: geo.attributes.uv
                  ? (geo.attributes.uv.array as Float32Array)
                  : null,
                index,
              },
              materialName: Array.isArray(mesh.material)
                ? mesh.material[0].name
                : (mesh.material as THREE.Material).name,
            };
          } else {
            return {
              type: "Group",
              name: obj.name,
              children: obj.children.map(serialize),
            };
          }
        };

        return serialize(object);
      };

      return parseObjAndCenter(text);
    });

    const joinResult = await handle.join();
    if (joinResult.ok) {
      resultValue = joinResult.value;
    } else {
      resultValue = parseObjAndCenterMain(objText);
    }
  } catch (err: any) {
    resultValue = parseObjAndCenterMain(objText);
  }

  const object = reconstructObject(resultValue);
  object.name = objectName;

  object.traverse((child: any) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      const requestedMaterialName = child.material?.name || null;
      if (requestedMaterialName && materialMap[requestedMaterialName]) {
        child.material = materialMap[requestedMaterialName];
      } else {
        const firstMatKey = Object.keys(materialMap)[0];
        if (firstMatKey) {
          child.material = materialMap[firstMatKey].clone();
        }
      }
    }
  });

  object.position.set(0, 0, 0);
  object.rotation.y = Math.PI;

  return object;
};

export const load3DObject = async ({
  type,
  id,
  cookie,
  objectName,
}: Load3DObjectOptions): Promise<THREE.Object3D> => {
  const name = objectName || `${type}_${id}`;
  const manifestUrl = await fetchManifestUrl(type, id, cookie);
  return loadFromManifest(manifestUrl, name);
};

export const load3DObjectFromUrl = async (
  manifestUrl: string,
  objectName: string = "3d_object",
): Promise<THREE.Object3D> => {
  return loadFromManifest(manifestUrl, objectName);
};

interface LoadAvatarOptions {
  userId: string;
  cookie: string;
  objectName?: string;
}

export const loadAvatarObject = async ({
  userId,
  cookie,
  objectName = "avatar",
}: LoadAvatarOptions) => {
  return load3DObject({ type: "avatar", id: userId, cookie, objectName });
};

export const loadAssetObject = async (
  assetId: number | string,
  cookie: string,
  objectName?: string,
) => {
  return load3DObject({ type: "asset", id: assetId, cookie, objectName });
};
