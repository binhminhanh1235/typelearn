export function TagFilter({
  categories = [],
  tags = [],
  selectedCategory = 'ALL',
  selectedTag = 'ALL',
  onSelectCategory,
  onSelectTag
}) {
  return (
    <section class="filter-section" aria-label="Bộ lọc bài học">
      <div class="filter-row">
        <span class="filter-label">Chuyên mục:</span>
        <button
          type="button"
          class={`chip-btn ${selectedCategory === 'ALL' ? 'active' : ''}`}
          onClick={() => onSelectCategory('ALL')}
        >
          Tất cả
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            class={`chip-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => onSelectCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {tags.length > 0 && (
        <div class="filter-row">
          <span class="filter-label">Thẻ (Tags):</span>
          <button
            type="button"
            class={`chip-btn ${selectedTag === 'ALL' ? 'active' : ''}`}
            onClick={() => onSelectTag('ALL')}
          >
            Mọi thẻ
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              class={`chip-btn ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => onSelectTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
