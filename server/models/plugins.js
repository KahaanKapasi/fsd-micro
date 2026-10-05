// Shared JSON contract: `_id` is always serialized as a string, Maps become plain objects.
export function jsonContract(schema) {
  schema.set('toJSON', {
    flattenMaps: true,
    versionKey: false,
    transform(_doc, ret) {
      ret._id = String(ret._id);
      delete ret.passwordHash;
      return ret;
    },
  });
}
