declare namespace GooglePhotos {
  type PagedResponse<T, K extends string> = {
    readonly nextPageToken: string;
  } & { readonly [P in PropertyName]: T[] }
  interface Album {
    readonly id: string;
    readonly title: string;
    readonly productUrl: string;
    readonly coverPhotoBaseUrl: string;
    readonly coverPhotoMediaItemId: string;
    readonly isWriteable: string;
    readonly mediaItemsCount: string;
  }
  type MediaMetadata = {
    readonly creationTime: string;
    readonly width: string;
    readonly height: string;
    readonly photo: {
      readonly cameraMake: string;
      readonly cameraModel: string;
      readonly focalLength: number;
      readonly apertureFNumber: number;
      readonly isoEquivalent: number;
      readonly exposureTime: string;
    };
  }
  type ContributorInfo = {
    readonly [key: string]: any
  }
  interface MediaItem {
    readonly id: string;
    readonly productUrl: string;
    readonly baseUrl: string;
    readonly mimeType: string;
    readonly mediaMetadata: MediaMetadata;
    readonly filename: string;
  }
}