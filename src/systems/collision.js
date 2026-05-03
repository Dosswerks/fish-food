/**
 * AABB collision detection.
 */
export class CollisionSystem {
  /**
   * Test AABB overlap between two bounding boxes.
   * @param {{ x, y, w, h }} a
   * @param {{ x, y, w, h }} b
   * @returns {boolean}
   */
  testAABB(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /**
   * Check all collisions for the current frame.
   * @param {object} player - Player entity with boundingBox
   * @param {object[]} entities - All collidable entities
   * @returns {object[]} Array of collision events
   */
  checkCollisions(player, entities) {
    const events = [];
    const pb = player.boundingBox;

    for (const entity of entities) {
      if (!entity.active && entity.active !== undefined) continue;
      if (this.testAABB(pb, entity.boundingBox)) {
        events.push({ player, entity, type: entity.collisionType || 'unknown' });
      }
    }
    return events;
  }

  /**
   * Prevent player from passing through static hazards.
   * Returns corrected position and collision normals.
   */
  resolveStaticCollisions(playerBox, statics) {
    const normals = [];
    let { x, y, w, h } = playerBox;

    for (const s of statics) {
      const sb = s.boundingBox || s;
      if (!(x < sb.x + sb.w && x + w > sb.x && y < sb.y + sb.h && y + h > sb.y)) continue;

      // Find smallest overlap axis to resolve
      const overlapLeft = (x + w) - sb.x;
      const overlapRight = (sb.x + sb.w) - x;
      const overlapTop = (y + h) - sb.y;
      const overlapBottom = (sb.y + sb.h) - y;
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      if (minOverlap === overlapLeft) { x = sb.x - w; normals.push({ x: -1, y: 0 }); }
      else if (minOverlap === overlapRight) { x = sb.x + sb.w; normals.push({ x: 1, y: 0 }); }
      else if (minOverlap === overlapTop) { y = sb.y - h; normals.push({ x: 0, y: -1 }); }
      else { y = sb.y + sb.h; normals.push({ x: 0, y: 1 }); }
    }

    return { x, y, normals };
  }

  /**
   * Confine a bounding box within tank boundaries.
   * @returns {{ x, y, normals }}
   */
  confineToBounds(playerBox, tankW, tankH) {
    let { x, y, w, h } = playerBox;
    const normals = [];
    if (x < 0) { x = 0; normals.push({ x: 1, y: 0 }); }
    if (x + w > tankW) { x = tankW - w; normals.push({ x: -1, y: 0 }); }
    if (y < 0) { y = 0; normals.push({ x: 0, y: 1 }); }
    if (y + h > tankH) { y = tankH - h; normals.push({ x: 0, y: -1 }); }
    return { x, y, normals };
  }
}
